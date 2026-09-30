"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { Invitation, Theme } from "@/types/invitation";
import { getDisplay, type Display } from "@/lib/display";
import { OrnamentIcon } from "./Ornaments";

export type ViewMode = "page" | "frame";

interface InvitationCtx {
  inv: Invitation;
  theme: Theme;
  mode: ViewMode;
  d: Display;
  /** 편집기 미리보기에서는 방명록 저장 등을 막습니다 */
  readOnly: boolean;
  toast: (message: string) => void;
}

const Ctx = createContext<InvitationCtx | null>(null);

export function InvitationProvider({
  value,
  children,
}: {
  value: Omit<InvitationCtx, "d" | "toast">;
  children: ReactNode;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toast = useCallback((m: string) => {
    setMessage(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 1800);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Ctx.Provider value={{ ...value, d: getDisplay(value.inv), toast }}>
      {children}
      {message && (
        <div
          role="status"
          className={`${value.mode === "page" ? "fixed" : "absolute"} left-1/2 bottom-8 z-50 -translate-x-1/2 rounded-full bg-black/75 px-5 py-2.5 text-sm text-white shadow-lg animate-fade-up`}
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {message}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useInv() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useInv must be used inside InvitationProvider");
  return v;
}

/** 사진 (불러오기 전/실패 시 부드러운 색 배경) */
export function Photo({
  src,
  alt = "",
  className = "",
  style,
}: {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        background: "linear-gradient(135deg, var(--inv-accent-soft), var(--inv-line))",
        ...style,
      }}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" draggable={false} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs opacity-60">사진을 추가해 주세요</div>
      )}
    </div>
  );
}

/** 화면에 들어오면 부드럽게 나타나기 */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${visible ? "is-visible" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** 섹션 제목: 영문 장식 + 한글 제목 */
export function SectionTitle({ en, ko }: { en: string; ko: string }) {
  const { theme } = useInv();
  return (
    <div className="mb-10 text-center">
      <p className="inv-script text-[26px] leading-none" style={{ color: "var(--inv-accent)" }}>
        {en}
      </p>
      <h2 className="inv-title mt-3 text-[15px] tracking-[0.12em]" style={{ color: "var(--inv-subtext)" }}>
        {ko}
      </h2>
      {theme.ornament !== "none" && (
        <div className="mt-4 flex justify-center">
          <OrnamentIcon type={theme.ornament} size={14} color="var(--inv-accent)" />
        </div>
      )}
    </div>
  );
}

export function Section({ children, className = "", id, tinted }: { children: ReactNode; className?: string; id?: string; tinted?: boolean }) {
  return (
    <section
      id={id}
      className={`relative px-7 py-20 ${className}`}
      style={tinted ? { background: "var(--inv-surface-tint)" } : undefined}
    >
      <Reveal>{children}</Reveal>
    </section>
  );
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

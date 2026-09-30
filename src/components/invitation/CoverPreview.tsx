"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Invitation, Theme } from "@/types/invitation";
import { Cover } from "./Covers";
import { themeVars } from "./InvitationView";
import { InvitationProvider } from "./shared";

const BASE_W = 375;
const BASE_H = 700;

/** 템플릿 카드용 표지 썸네일 (375×700 화면을 카드 크기에 맞게 축소) */
export function CoverPreview({ invitation, theme }: { invitation: Invitation; theme: Theme }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / BASE_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className="relative w-full overflow-hidden" style={{ aspectRatio: `${BASE_W} / ${BASE_H}`, background: theme.palette.bg }}>
      <InvitationProvider value={{ inv: invitation, theme, mode: "frame", readOnly: true }}>
        <div
          className="inv pointer-events-none absolute left-0 top-0 origin-top-left transition-opacity duration-300"
          style={
            {
              ...themeVars(theme),
              "--cover-h": `${BASE_H}px`,
              width: BASE_W,
              height: BASE_H,
              transform: `scale(${scale})`,
              opacity: scale ? 1 : 0,
              backgroundColor: "var(--inv-bg)",
              backgroundImage: theme.pattern,
              backgroundSize: "40px 40px",
            } as CSSProperties
          }
          aria-hidden
        >
          <Cover showHint={false} />
        </div>
      </InvitationProvider>
    </div>
  );
}

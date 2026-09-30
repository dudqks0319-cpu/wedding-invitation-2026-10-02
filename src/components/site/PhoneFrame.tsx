"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const SCREEN_W = 375;

/**
 * 휴대폰 모양 틀 (미리보기용)
 * 안쪽 화면은 항상 실제 휴대폰 너비(375px)로 그린 뒤 틀 크기에 맞게 줄여서 보여줘요.
 */
export function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  const screen = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = screen.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = size && size.w > 0 ? size.w / SCREEN_W : 0;

  return (
    <div
      className={`relative mx-auto aspect-[9/19] w-full max-w-[340px] rounded-[44px] border border-black/5 bg-white p-2.5 shadow-[0_30px_80px_-20px_rgba(242,95,125,0.35),0_10px_30px_rgba(0,0,0,0.08)] ${className}`}
    >
      <div ref={screen} className="relative h-full w-full overflow-hidden rounded-[36px] bg-white">
        {scale > 0 && size && (
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ width: SCREEN_W, height: size.h / scale, transform: `scale(${scale})` }}
          >
            {children}
          </div>
        )}
        <div className="pointer-events-none absolute left-1/2 top-2 z-40 h-6 w-24 -translate-x-1/2 rounded-full bg-black/85" style={{ transform: `translateX(-50%) scale(${Math.min(1, scale)})`, transformOrigin: "top center" }} />
      </div>
    </div>
  );
}

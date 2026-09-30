"use client";

import type { Effect } from "@/types/invitation";
import { LeafIcon, PetalIcon, SparkleIcon } from "./Ornaments";

/** 화면 위로 떨어지는 꽃잎·색종이·반짝이 효과 */

// 서버/브라우저에서 같은 값이 나오도록 고정된 "랜덤" 배치 사용
const SEEDS = [
  [5, 0, 9, 14], [18, 3.2, 11, 10], [31, 6.5, 8, 16], [44, 1.4, 12, 12], [57, 4.8, 10, 9],
  [70, 2.2, 9, 15], [83, 7.1, 13, 11], [94, 5.5, 10, 13], [12, 9, 11, 8], [63, 8.3, 12, 14],
] as const;

const CONFETTI = ["#F9B4C4", "#FFD98A", "#A8D8E8", "#C8B6EE", "#B9E2C4"];

export function EffectLayer({ effect, mode }: { effect: Effect; mode: "page" | "frame" }) {
  if (effect === "none") return null;
  const pos = mode === "page" ? "fixed" : "absolute";
  const anim = mode === "page" ? "fall" : "fall-frame";

  return (
    <div className={`fx-layer pointer-events-none ${pos} inset-0 z-30 overflow-hidden`} aria-hidden>
      {SEEDS.map(([left, delay, dur, size], i) => {
        if (effect === "sparkle") {
          return (
            <span
              key={i}
              className="absolute"
              style={{ left: `${left}%`, top: `${(i * 37) % 90}%`, animation: `twinkle ${2 + (i % 3)}s ease-in-out ${delay / 2}s infinite` }}
            >
              <SparkleIcon size={size - 2} color="var(--inv-accent)" />
            </span>
          );
        }
        return (
          <span
            key={i}
            className="absolute -top-8"
            style={
              {
                left: `${left}%`,
                animation: `${anim} ${dur + 4}s linear ${delay}s infinite`,
                "--drift": `${i % 2 ? 60 : -40}px`,
                "--spin": `${i % 2 ? 300 : -260}deg`,
              } as React.CSSProperties
            }
          >
            {effect === "petals" && <PetalIcon size={size} color="var(--inv-accent)" />}
            {effect === "leaves" && <LeafIcon size={size / 1.6} color="var(--inv-accent)" />}
            {effect === "snow" && <span className="block rounded-full bg-white/90" style={{ width: size / 2, height: size / 2 }} />}
            {effect === "confetti" && (
              <span className="block rounded-[2px]" style={{ width: size / 1.6, height: size / 2.6, background: CONFETTI[i % CONFETTI.length] }} />
            )}
          </span>
        );
      })}
    </div>
  );
}

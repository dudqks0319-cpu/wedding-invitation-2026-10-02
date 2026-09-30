"use client";

import { useRef, useState } from "react";
import { useInv } from "./shared";

/** 오른쪽 위 배경음악 버튼 */
export function MusicButton() {
  const { inv, mode, toast } = useInv();
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = async () => {
    if (!inv.options.bgmUrl || !audio.current) {
      toast("배경음악은 만들기 화면에서 추가할 수 있어요");
      return;
    }
    if (playing) {
      audio.current.pause();
      setPlaying(false);
    } else {
      try {
        await audio.current.play();
        setPlaying(true);
      } catch {
        toast("음악을 재생할 수 없어요");
      }
    }
  };

  return (
    <>
      {inv.options.bgmUrl && <audio ref={audio} src={inv.options.bgmUrl} loop preload="none" />}
      <button
        onClick={toggle}
        className={`${mode === "page" ? "fixed" : "absolute right-4"} top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow-md backdrop-blur`}
        style={{ color: "var(--inv-accent)", right: mode === "page" ? "max(1rem, calc(50vw - 240px + 1rem))" : undefined }}
        aria-label={playing ? "배경음악 끄기" : "배경음악 켜기"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" className={playing ? "animate-[spin-slow_4s_linear_infinite]" : ""} aria-hidden>
          <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6" cy="18" r="3" fill="currentColor" />
          <circle cx="18" cy="16" r="3" fill="currentColor" />
          {!playing && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        </svg>
      </button>
    </>
  );
}

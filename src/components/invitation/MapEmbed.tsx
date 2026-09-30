"use client";

import { useEffect, useRef, useState } from "react";
import type { Venue } from "@/types/invitation";
import { KAKAO_MAP_KEY, NAVER_MAP_CLIENT_ID } from "@/lib/maps";

/**
 * 지도 화면
 * - .env.local 에 NEXT_PUBLIC_KAKAO_MAP_KEY 가 있으면 → 카카오 지도
 * - 없고 NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 가 있으면 → 네이버 지도
 * - 둘 다 없으면 → 예쁜 그림 지도(자리표시)
 */

type Win = Window & {
  kakao?: {
    maps: {
      load: (cb: () => void) => void;
      LatLng: new (lat: number, lng: number) => unknown;
      Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
      Marker: new (opts: Record<string, unknown>) => { setMap: (m: unknown) => void };
    };
  };
  naver?: {
    maps: {
      LatLng: new (lat: number, lng: number) => unknown;
      Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
      Marker: new (opts: Record<string, unknown>) => unknown;
    };
  };
};

function loadScript(src: string, id: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded) resolve();
      else existing.addEventListener("load", () => resolve());
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.src = src;
    s.async = true;
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => reject(new Error("map script failed"));
    document.head.appendChild(s);
  });
}

export function MapEmbed({ venue }: { venue: Venue }) {
  const ref = useRef<HTMLDivElement>(null);
  const provider = KAKAO_MAP_KEY ? "kakao" : NAVER_MAP_CLIENT_ID ? "naver" : "none";
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || provider === "none") return;
    const w = window as Win;
    let cancelled = false;

    if (provider === "kakao") {
      loadScript(`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_KEY}&autoload=false`, "kakao-map-sdk")
        .then(() => {
          w.kakao?.maps.load(() => {
            if (cancelled || !w.kakao) return;
            const { maps } = w.kakao;
            const center = new maps.LatLng(venue.lat, venue.lng);
            const map = new maps.Map(el, { center, level: 3, draggable: true });
            new maps.Marker({ position: center }).setMap(map);
          });
        })
        .catch(() => setFailed(true));
    } else {
      loadScript(`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_MAP_CLIENT_ID}`, "naver-map-sdk")
        .then(() => {
          if (cancelled || !w.naver) return;
          const { maps } = w.naver;
          const center = new maps.LatLng(venue.lat, venue.lng);
          const map = new maps.Map(el, { center, zoom: 16 });
          new maps.Marker({ position: center, map });
        })
        .catch(() => setFailed(true));
    }
    return () => {
      cancelled = true;
    };
  }, [provider, venue.lat, venue.lng]);

  if (provider === "none" || failed) return <IllustratedMap venue={venue} />;
  return <div ref={ref} className="h-64 w-full overflow-hidden rounded-2xl" aria-label={`${venue.name} 지도`} />;
}

/** API 키가 없을 때 보여주는 그림 지도 */
function IllustratedMap({ venue }: { venue: Venue }) {
  return (
    <div className="relative h-64 w-full overflow-hidden rounded-2xl" style={{ background: "var(--inv-surface-tint)" }}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <rect width="400" height="260" fill="var(--inv-accent-soft)" opacity="0.5" />
        <path d="M-10 70 L410 110" stroke="#fff" strokeWidth="18" />
        <path d="M-10 200 L410 170" stroke="#fff" strokeWidth="12" />
        <path d="M120 -10 L150 270" stroke="#fff" strokeWidth="14" />
        <path d="M290 -10 L260 270" stroke="#fff" strokeWidth="10" />
        <rect x="170" y="20" width="70" height="60" rx="8" fill="#fff" opacity=".6" />
        <rect x="30" y="120" width="70" height="50" rx="8" fill="#fff" opacity=".6" />
        <rect x="300" y="190" width="80" height="50" rx="8" fill="#fff" opacity=".6" />
        <circle cx="330" cy="50" r="26" fill="#CFE8C4" opacity=".8" />
        <path d="M-10 240 Q100 220 200 245 T410 235" stroke="#BFDDF2" strokeWidth="14" fill="none" opacity=".8" />
      </svg>
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
        <span className="whitespace-nowrap rounded-full bg-white px-3 py-1 text-[12px] font-semibold shadow-md" style={{ color: "var(--inv-text)", fontFamily: "var(--font-sans)" }}>
          {venue.name}
        </span>
        <svg width="34" height="44" viewBox="0 0 34 44" className="-mt-0.5 drop-shadow-md" aria-hidden>
          <path d="M17 0 C7.6 0 0 7.4 0 16.6 C0 29 17 44 17 44 S34 29 34 16.6 C34 7.4 26.4 0 17 0Z" fill="var(--inv-accent)" />
          <circle cx="17" cy="16" r="6" fill="#fff" />
        </svg>
      </div>
      <span className="absolute bottom-2 right-3 rounded bg-white/80 px-2 py-0.5 text-[10px] text-black/50" style={{ fontFamily: "var(--font-sans)" }}>
        지도 API 키 연결 전 미리보기
      </span>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { Venue } from "@/types/invitation";
import { KAKAO_MAP_KEY, NAVER_MAP_CLIENT_ID } from "@/lib/maps";

/**
 * 지도 화면
 * - .env.local 에 NEXT_PUBLIC_KAKAO_MAP_KEY 가 있으면 → 카카오 지도
 * - 없고 NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 가 있으면 → 네이버 지도
 * - 둘 다 없으면 → 주소 안내와 지도 앱 링크
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

  if (provider === "none" || failed) return <AddressNotice venue={venue} />;
  return <div ref={ref} className="h-64 w-full overflow-hidden rounded-2xl" aria-label={`${venue.name} 지도`} />;
}

function AddressNotice({ venue }: { venue: Venue }) {
  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-2xl px-5 py-8 text-center" style={{ background: "var(--inv-surface-tint)",fontFamily:"var(--font-sans)" }}>
        <svg width="34" height="44" viewBox="0 0 34 44" aria-hidden>
          <path d="M17 0 C7.6 0 0 7.4 0 16.6 C0 29 17 44 17 44 S34 29 34 16.6 C34 7.4 26.4 0 17 0Z" fill="var(--inv-accent)" />
          <circle cx="17" cy="16" r="6" fill="#fff" />
        </svg>
        <p className="text-[14px] font-semibold">{venue.name}</p>
        <p className="text-[13px]">{venue.address}</p>
        <p className="text-[12px]" style={{color:'var(--inv-subtext)'}}>아래 지도 앱에서 위치와 경로를 확인해 주세요</p>
    </div>
  );
}

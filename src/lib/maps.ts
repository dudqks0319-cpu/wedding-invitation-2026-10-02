import type { Venue } from "@/types/invitation";

/**
 * 지도 앱으로 바로 연결되는 링크 (API 키 없이 동작)
 * 지도 "화면"을 페이지 안에 띄우려면 .env.local 에 키를 넣으세요. (docs/BACKEND_HANDOFF.md 참고)
 */
export function kakaoMapUrl(v: Venue) {
  if (!hasCoordinates(v)) return `https://map.kakao.com/link/search/${encodeURIComponent(v.address)}`;
  return `https://map.kakao.com/link/map/${encodeURIComponent(v.name)},${v.lat},${v.lng}`;
}

export function kakaoRouteUrl(v: Venue) {
  if (!hasCoordinates(v)) return kakaoMapUrl(v);
  return `https://map.kakao.com/link/to/${encodeURIComponent(v.name)},${v.lat},${v.lng}`;
}

export function naverMapUrl(v: Venue) {
  return `https://map.naver.com/p/search/${encodeURIComponent(v.address)}`;
}

export function hasCoordinates(v: Venue) {
  return Number.isFinite(v.lat) && Number.isFinite(v.lng) && Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180 && (v.lat !== 0 || v.lng !== 0);
}

export function tmapUrl(v: Venue) {
  return `tmap://route?goalname=${encodeURIComponent(v.name)}&goalx=${v.lng}&goaly=${v.lat}`;
}

export const KAKAO_MAP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
export const NAVER_MAP_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? "";

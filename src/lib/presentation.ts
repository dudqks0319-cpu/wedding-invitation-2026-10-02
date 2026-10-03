import type { CoverPresentation, InvitationFont } from "@/types/invitation";

export const INVITATION_FONTS: { id: InvitationFont; label: string; family?: string }[] = [
  { id: "default", label: "디자인 기본 글꼴" },
  { id: "gowun-batang", label: "고운바탕 · 단정한 손편지", family: '"Gowun Batang", serif' },
  { id: "gowun-dodum", label: "고운돋움 · 부드러운 글씨", family: '"Gowun Dodum", sans-serif' },
  { id: "pretendard", label: "프리텐다드 · 또렷한 글씨", family: '"Pretendard Variable", Pretendard, sans-serif' },
];
export const DEFAULT_COVER: CoverPresentation = { x: 0.5, y: 0.5, zoom: 1, fit: "cover" };

/** Adapted from Osamosam's photo-presentation; the original image stays intact. */
export function photoPresentationStyle(value: CoverPresentation = DEFAULT_COVER) {
  const position = `${value.x * 100}% ${value.y * 100}%`;
  return { objectFit: value.fit, objectPosition: position, transform: `scale(${value.zoom})`, transformOrigin: position };
}

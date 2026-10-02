import { GENERATED_PHOTOS } from "./photos.generated";

/**
 * 예시 사진 자리 목록
 * - public/photos/<key>.webp 가 있으면 그 사진(AI 생성 사진)을 사용
 * - 없으면 public/samples 의 일러스트를 대신 보여줘요.
 * 사진 주문서(프롬프트): scripts/photo-brief.json
 */
const FALLBACK = {
  "wedding-blossom": "/samples/couple-sunset.svg",
  "wedding-classic": "/samples/bouquet.svg",
  "wedding-garden": "/samples/couple-garden.svg",
  "wedding-polaroid": "/samples/couple-sky.svg",
  "wedding-sky": "/samples/couple-sky.svg",
  "wedding-film": "/samples/couple-sunset.svg",
  "wedding-lavender": "/samples/lavender.svg",
  "wedding-city": "/samples/city.svg",
  "wedding-beach": "/samples/beach.svg",
  "wedding-hanbok": "/samples/hanok.svg",
  "wedding-rings": "/samples/rings.svg",
  "wedding-bouquet": "/samples/bouquet.svg",
  "wedding-picnic": "/samples/couple-garden.svg",
  "gallery-hands": "/samples/rings.svg",
  "gallery-veil": "/samples/couple-sky.svg",
  "gallery-walk": "/samples/couple-garden.svg",
  "gallery-laugh": "/samples/couple-sunset.svg",
  "dol-balloon": "/samples/baby-balloon.svg",
  "dol-bear": "/samples/baby-bear.svg",
  "dol-hanbok": "/samples/baby-balloon.svg",
  "dol-moon": "/samples/baby-moon.svg",
  "dol-family": "/samples/baby-bear.svg",
  "dol-cake": "/samples/baby-balloon.svg",
  "party-mother": "/samples/parents.svg",
  "party-couple": "/samples/parents.svg",
  "party-family": "/samples/parents.svg",
} as const;

export type PhotoKey = keyof typeof FALLBACK;

export function photo(key: PhotoKey): string {
  return GENERATED_PHOTOS[key] ?? FALLBACK[key];
}

export const ALL_PHOTO_KEYS = Object.keys(FALLBACK) as PhotoKey[];

/** 실제 사진(AI 생성)이 하나라도 들어왔는지 */
export const HAS_REAL_PHOTOS = Object.keys(GENERATED_PHOTOS).length > 0;

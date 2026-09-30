/**
 * 청첩장/초대장 데이터 구조
 *
 * 백엔드(DB) 스키마를 만들 때 이 타입을 그대로 기준으로 삼으면 됩니다.
 * 자세한 내용은 docs/BACKEND_HANDOFF.md 참고.
 */

/** 행사 종류 */
export type EventType = "wedding" | "dol" | "party";

/** 신랑/신부 한 사람의 정보 */
export interface Partner {
  name: string;
  englishName?: string;
  /** 장남, 차녀 등 */
  order: string;
  phone?: string;
  father?: string;
  mother?: string;
  fatherPhone?: string;
  motherPhone?: string;
  /** 故 표시 여부 */
  fatherDeceased?: boolean;
  motherDeceased?: boolean;
}

export interface WeddingInfo {
  groom: Partner;
  bride: Partner;
}

export interface DolInfo {
  babyName: string;
  babyEnglishName?: string;
  /** 아기 생일 (YYYY-MM-DD) */
  birthDate: string;
  father: string;
  mother: string;
  phone?: string;
}

export interface PartyInfo {
  /** 주인공 이름 */
  honoreeName: string;
  /** 칠순, 팔순, 회갑 등 */
  eventName: string;
  /** 초대하는 사람 (예: 자녀 일동) */
  hostName: string;
  phone?: string;
}

export interface Venue {
  name: string;
  hall?: string;
  address: string;
  tel?: string;
  lat: number;
  lng: number;
  subway?: string;
  bus?: string;
  parking?: string;
  car?: string;
}

export interface Account {
  id: string;
  side: "groom" | "bride" | "host";
  /** 신랑, 신랑 아버지 등 */
  label: string;
  bank: string;
  number: string;
  holder: string;
  kakaoPayUrl?: string;
}

export interface InvitationOptions {
  showCalendar: boolean;
  showDday: boolean;
  showGallery: boolean;
  showAccounts: boolean;
  showGuestbook: boolean;
  showRsvp: boolean;
  /** 꽃잎/눈/반짝이 효과 */
  showEffect: boolean;
  bgmUrl?: string;
}

export interface Invitation {
  /** 청첩장 고유 주소 (예: /i/minjun-seoyeon) */
  slug: string;
  templateId: string;
  type: EventType;
  wedding?: WeddingInfo;
  dol?: DolInfo;
  party?: PartyInfo;
  /** 행사 일시 (YYYY-MM-DDTHH:mm) */
  dateTime: string;
  venue: Venue;
  greetingTitle: string;
  greeting: string;
  coverPhoto: string;
  gallery: string[];
  accounts: Account[];
  options: InvitationOptions;
  /** 카카오톡 공유 시 보여질 문구 */
  shareTitle?: string;
  shareDescription?: string;
}

export interface GuestbookEntry {
  id: string;
  name: string;
  message: string;
  createdAt: string;
}

export interface RsvpEntry {
  id: string;
  side: "groom" | "bride" | "host";
  name: string;
  attending: boolean;
  count: number;
  meal: "yes" | "no" | "unknown";
  memo?: string;
  createdAt: string;
}

/* ---------------- 디자인 테마 ---------------- */

export type CoverVariant =
  | "arch"
  | "letter"
  | "botanical"
  | "polaroid"
  | "envelope"
  | "film"
  | "circle"
  | "magazine"
  | "fullPhoto"
  | "hanji"
  | "split"
  | "watercolor"
  | "gingham"
  | "balloon"
  | "bear"
  | "saekdong"
  | "starry"
  | "peony"
  | "sunrise";

export type Ornament =
  | "none"
  | "petal"
  | "leaf"
  | "cloud"
  | "sparkle"
  | "line"
  | "knot"
  | "heart"
  | "star"
  | "balloon";

export type Effect = "none" | "petals" | "snow" | "sparkle" | "confetti" | "leaves";

export interface ThemePalette {
  /** 전체 배경 */
  bg: string;
  /** 카드/박스 배경 */
  surface: string;
  text: string;
  subtext: string;
  /** 포인트 색 */
  accent: string;
  /** 포인트 연한 색 */
  accentSoft: string;
  line: string;
}

export interface Theme {
  id: string;
  name: string;
  nameEn: string;
  category: EventType;
  description: string;
  tags: string[];
  isNew?: boolean;
  isBest?: boolean;
  cover: CoverVariant;
  ornament: Ornament;
  effect: Effect;
  palette: ThemePalette;
  fonts: {
    /** 제목 (한글) */
    title: string;
    /** 본문 */
    body: string;
    /** 영문 장식 글씨 */
    script: string;
  };
  /** 배경 무늬 (CSS background 값) */
  pattern?: string;
  samplePhoto: string;
}

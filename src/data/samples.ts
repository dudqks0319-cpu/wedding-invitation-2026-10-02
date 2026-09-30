import type { EventType, Invitation, Theme } from "@/types/invitation";
import { TEMPLATES, getTemplate } from "./templates";

/**
 * 미리보기에 쓰이는 예시 데이터입니다.
 * 백엔드가 붙기 전까지는 이 데이터로 화면을 보여줍니다.
 */

const WEDDING_GALLERY = [
  "/samples/couple-sunset.svg",
  "/samples/couple-garden.svg",
  "/samples/bouquet.svg",
  "/samples/couple-sky.svg",
  "/samples/rings.svg",
  "/samples/lavender.svg",
  "/samples/beach.svg",
  "/samples/city.svg",
  "/samples/hanok.svg",
];

const DOL_GALLERY = [
  "/samples/baby-balloon.svg",
  "/samples/baby-bear.svg",
  "/samples/baby-moon.svg",
  "/samples/bouquet.svg",
  "/samples/couple-garden.svg",
  "/samples/couple-sky.svg",
];

const PARTY_GALLERY = [
  "/samples/parents.svg",
  "/samples/hanok.svg",
  "/samples/bouquet.svg",
  "/samples/couple-garden.svg",
];

const DEFAULT_OPTIONS = {
  showCalendar: true,
  showDday: true,
  showGallery: true,
  showAccounts: true,
  showGuestbook: true,
  showRsvp: true,
  showEffect: true,
};

function weddingSample(theme: Theme): Invitation {
  return {
    slug: `sample-${theme.id}`,
    templateId: theme.id,
    type: "wedding",
    wedding: {
      groom: {
        name: "김민준",
        englishName: "Minjun",
        order: "장남",
        phone: "010-1234-5678",
        father: "김철수",
        mother: "박영희",
        fatherPhone: "010-1111-2222",
        motherPhone: "010-3333-4444",
      },
      bride: {
        name: "이서연",
        englishName: "Seoyeon",
        order: "차녀",
        phone: "010-8765-4321",
        father: "이정훈",
        mother: "최미경",
        fatherDeceased: true,
        motherPhone: "010-5555-6666",
      },
    },
    dateTime: "2027-04-17T12:30",
    venue: {
      name: "라온 웨딩홀",
      hall: "3층 그랜드볼룸",
      address: "서울특별시 강남구 테헤란로 123",
      tel: "02-123-4567",
      lat: 37.5006,
      lng: 127.0364,
      subway: "2호선 역삼역 3번 출구 도보 5분",
      bus: "간선 146, 341, 360 / 지선 3412 · 역삼역 정류장 하차",
      parking: "건물 지하 주차장 2시간 무료 (안내데스크에서 주차 등록)",
      car: "내비게이션에 '라온 웨딩홀' 또는 '테헤란로 123' 검색",
    },
    greetingTitle: "소중한 분들을 초대합니다",
    greeting:
      "서로 다른 길을 걸어온 두 사람이\n이제 같은 곳을 바라보며\n한 길을 함께 걸어가려 합니다.\n\n저희의 새로운 시작을\n가까이에서 축복해 주시면\n더없는 기쁨으로 간직하겠습니다.",
    coverPhoto: theme.samplePhoto,
    gallery: WEDDING_GALLERY,
    accounts: [
      { id: "a1", side: "groom", label: "신랑", bank: "국민은행", number: "123456-01-234567", holder: "김민준", kakaoPayUrl: "#" },
      { id: "a2", side: "groom", label: "신랑 아버지", bank: "신한은행", number: "110-123-456789", holder: "김철수" },
      { id: "a3", side: "groom", label: "신랑 어머니", bank: "우리은행", number: "1002-123-456789", holder: "박영희" },
      { id: "a4", side: "bride", label: "신부", bank: "카카오뱅크", number: "3333-01-2345678", holder: "이서연", kakaoPayUrl: "#" },
      { id: "a5", side: "bride", label: "신부 어머니", bank: "하나은행", number: "123-456789-01234", holder: "최미경" },
    ],
    options: { ...DEFAULT_OPTIONS },
    shareTitle: "김민준 ♥ 이서연 결혼합니다",
    shareDescription: "2027년 4월 17일 토요일 오후 12시 30분 · 라온 웨딩홀",
  };
}

function dolSample(theme: Theme): Invitation {
  return {
    slug: `sample-${theme.id}`,
    templateId: theme.id,
    type: "dol",
    dol: {
      babyName: "박하준",
      babyEnglishName: "Hajun",
      birthDate: "2026-01-10",
      father: "박지훈",
      mother: "정유진",
      phone: "010-2468-1357",
    },
    dateTime: "2027-01-16T12:00",
    venue: {
      name: "소담 한정식",
      hall: "2층 연회룸 '봄'",
      address: "서울특별시 마포구 월드컵북로 45",
      tel: "02-987-6543",
      lat: 37.5563,
      lng: 126.9236,
      subway: "2호선 홍대입구역 1번 출구 도보 7분",
      bus: "마포08, 7011 · 홍대입구역 정류장 하차",
      parking: "건물 뒤편 전용 주차장 이용 (2시간 무료)",
    },
    greetingTitle: "하준이의 첫 번째 생일",
    greeting:
      "작고 여린 손으로 저희에게 와\n온 세상을 환하게 밝혀준 하준이가\n벌써 첫 번째 생일을 맞이했습니다.\n\n그동안 사랑으로 지켜봐 주신\n고마운 분들을 모시고\n작은 돌잔치를 준비했습니다.\n오셔서 축복해 주세요.",
    coverPhoto: theme.samplePhoto,
    gallery: DOL_GALLERY,
    accounts: [
      { id: "d1", side: "host", label: "아빠", bank: "국민은행", number: "123456-02-345678", holder: "박지훈" },
      { id: "d2", side: "host", label: "엄마", bank: "카카오뱅크", number: "3333-02-3456789", holder: "정유진", kakaoPayUrl: "#" },
    ],
    options: { ...DEFAULT_OPTIONS, showRsvp: true },
    shareTitle: "박하준 첫 돌잔치에 초대합니다",
    shareDescription: "2027년 1월 16일 토요일 낮 12시 · 소담 한정식",
  };
}

function partySample(theme: Theme): Invitation {
  // 해돋이 디자인은 아버지 회갑연 예시로 보여주기
  const isFather = theme.id === "party-sunrise";
  const honoree = isFather ? "김영호" : "정순자";
  const eventName = isFather ? "회갑" : "칠순";
  const base: Invitation = {
    slug: `sample-${theme.id}`,
    templateId: theme.id,
    type: "party",
    party: {
      honoreeName: "정순자",
      eventName: "칠순",
      hostName: "자녀 일동",
      phone: "010-1357-2468",
    },
    dateTime: "2026-11-21T18:00",
    venue: {
      name: "한가람 컨벤션",
      hall: "5층 다이아몬드홀",
      address: "경기도 성남시 분당구 황새울로 200",
      tel: "031-123-4567",
      lat: 37.3827,
      lng: 127.1189,
      subway: "수인분당선 서현역 2번 출구 도보 3분",
      bus: "일반 17, 55 · 서현역 정류장 하차",
      parking: "건물 내 주차 3시간 무료",
    },
    greetingTitle: "어머니의 칠순을 축하해 주세요",
    greeting:
      "언제나 따뜻한 미소로\n가족의 버팀목이 되어 주신 어머니께서\n어느덧 일흔 번째 생신을 맞으셨습니다.\n\n그 사랑에 조금이나마 보답하고자\n작은 자리를 마련하였습니다.\n귀한 걸음 하시어 축하해 주시면\n감사하겠습니다.",
    coverPhoto: theme.samplePhoto,
    gallery: PARTY_GALLERY,
    accounts: [
      { id: "p1", side: "host", label: "장남", bank: "농협은행", number: "302-1234-5678-91", holder: "김대현" },
      { id: "p2", side: "host", label: "장녀", bank: "신한은행", number: "110-234-567890", holder: "김수정" },
    ],
    options: { ...DEFAULT_OPTIONS, showRsvp: true, showGuestbook: true },
    shareTitle: "정순자 여사 칠순 잔치에 초대합니다",
    shareDescription: "2026년 11월 21일 토요일 오후 6시 · 한가람 컨벤션",
  };
  if (!isFather) return base;
  return {
    ...base,
    party: { ...base.party!, honoreeName: honoree, eventName },
    greetingTitle: "아버지의 회갑을 축하해 주세요",
    greeting: base.greeting.replace("어머니께서", "아버지께서").replace("일흔 번째", "예순 번째"),
    shareTitle: `${honoree} 님 ${eventName} 잔치에 초대합니다`,
  };
}

export function createSample(theme: Theme): Invitation {
  const byType: Record<EventType, (t: Theme) => Invitation> = {
    wedding: weddingSample,
    dol: dolSample,
    party: partySample,
  };
  return byType[theme.category](theme);
}

/** /i/sample-blossom 처럼 템플릿별 예시 청첩장 */
export function getSampleBySlug(slug: string): Invitation | undefined {
  if (!slug.startsWith("sample-")) return undefined;
  const theme = getTemplate(slug.replace("sample-", ""));
  return theme ? createSample(theme) : undefined;
}

export const SAMPLE_SLUGS = TEMPLATES.map((t) => `sample-${t.id}`);

# Codex 작업 2 — 백엔드 만들기

너는 이 저장소(`invitation-web/`, Next.js 16 App Router + TypeScript + Tailwind v4)의 백엔드 담당이야.
프론트엔드는 완성되어 있고, 지금은 데이터를 브라우저 localStorage 에만 저장해.
**`docs/BACKEND_HANDOFF.md` 를 먼저 끝까지 읽고** 그 명세대로 백엔드를 붙여줘.
(이 Next.js 는 버전이 새로워서 API 가 다를 수 있어 — `node_modules/next/dist/docs/` 의 문서를 확인하고 써. `AGENTS.md` 참고)

## 기술 선택 (이대로 진행)
- **DB · 로그인 · 파일 저장: Supabase** (PostgreSQL + Auth + Storage), `@supabase/ssr` 사용
- 서버 API: Next.js **Route Handlers** (`src/app/api/**/route.ts`)
- 입력 검증: `zod` (프론트와 같은 규칙 — HANDOFF 문서 3장)
- 방명록 비밀번호: `bcryptjs` 로 해시 저장

## 단계별로 해줘 (단계마다 커밋)
1. **DB 스키마**: `supabase/migrations/0001_init.sql` — HANDOFF 2장의 테이블(users 는 Supabase auth.users 사용), 인덱스, **RLS 정책**
   (청첩장은 누구나 읽기 / 소유자만 쓰기·삭제, 방명록·RSVP 는 누구나 쓰기 / RSVP 목록은 소유자만 읽기).
2. **API**: HANDOFF 3장 표의 모든 엔드포인트. slug 중복은 409, 검증 실패는 400 + 한국어 메시지.
   방명록·RSVP POST 에는 IP 기준 간단한 요청 제한(rate limit)을 넣어.
3. **프론트 연결**: `src/lib/api.ts` 의 함수 **이름과 반환 타입은 그대로** 두고 내부만 바꿔.
   - `NEXT_PUBLIC_DATA_MODE=local|remote` 환경 변수로 전환되게 해. **기본값과 `npm run build:preview` 는 `local`**(지금처럼 localStorage) 이어야 해. 미리보기 빌드가 깨지면 안 돼.
   - 훅(`useMyInvitations` 등)은 remote 모드에서 SWR 로 구현해도 돼.
4. **사진 업로드**: `src/lib/image.ts` — remote 모드에서는 줄인 이미지를 Supabase Storage(`invitation-photos` 버킷)에 올리고 공개 URL 반환.
5. **청첩장 페이지 서버 렌더링**: `src/app/i/[slug]/page.tsx` — remote 모드에서 서버에서 DB 조회 후 렌더, `generateMetadata` 에 og:title / og:description / og:image(대표 사진) 채우기 → 카카오톡 공유 미리보기.
6. **로그인**: `/login` 의 카카오 버튼 → Supabase Auth 카카오 로그인. 구글도 Supabase 로. 네이버는 Supabase 기본 지원이 없으니 버튼은 "준비 중" 안내 유지(또는 커스텀 OAuth 를 별도 단계로 제안).
   `/my`, `/create` 저장은 로그인 필요(비로그인 시 `/login` 으로 안내, 작성 중 내용은 localStorage 에 임시 보관).
7. **카카오톡 공유**: `EndingSection` 에 Kakao JS SDK `Kakao.Share.sendDefault` 적용 (`NEXT_PUBLIC_KAKAO_JS_KEY` 없으면 지금처럼 링크 복사).
8. **문서**: `.env.example` 에 새 환경 변수 추가, `README.md` 에 "Supabase 프로젝트 만들기 → 키 넣기 → 마이그레이션 실행" 순서를 **비개발자도 따라 할 수 있게 한국어로** 적어줘.

## 지켜야 할 것
- 화면 디자인(컴포넌트 모양, 색, 글꼴)은 바꾸지 마. 필요한 경우 로딩/에러 상태만 추가.
- 비밀 키(`SUPABASE_SERVICE_ROLE_KEY` 등)는 서버 코드에서만 사용하고 절대 `NEXT_PUBLIC_` 로 노출하지 마.
- 키가 하나도 없어도 `npm run dev` / `npm run build` / `npm run build:preview` 가 성공해야 해 (local 모드로 동작).
- 끝나면 `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run build:preview` 모두 통과 확인.
- 커밋 메시지는 영어로, 단계별로.

# 백엔드 작업 안내 (Codex 전달용)

이 문서는 프론트엔드(Next.js 16 App Router, TypeScript, Tailwind v4)에 백엔드를 붙이기 위한 명세입니다.
**화면 코드는 건드리지 않고** 아래 연결 지점만 바꾸면 되도록 설계했습니다.

## 1. 연결 지점

| 파일 | 지금 | 바꿀 것 |
| --- | --- | --- |
| `src/lib/api.ts` | localStorage 저장 | 각 함수 내부를 `fetch('/api/...')` 로 교체 (함수 이름·반환 타입 유지). 훅(`useMyInvitations`, `useGuestbook`, `useRsvpList`)은 SWR/React Query 등으로 교체 가능 |
| `src/lib/image.ts` | 사진을 data URL 로 변환 | 스토리지(S3/R2/Supabase Storage 등) 업로드 후 URL 반환 |
| `src/app/i/[slug]/page.tsx` | 예시(`sample-*`) 외에는 클라이언트에서 localStorage 조회 | 서버에서 DB 조회 후 `InvitationView` 렌더 + `generateMetadata` 에 og:title/og:image 채우기 (카카오톡 미리보기) |
| `src/app/(site)/login/page.tsx` | 버튼만 있음 | 카카오 / 네이버 / 구글 OAuth |
| `src/components/invitation/Sections.tsx` → `EndingSection` | Web Share / 링크 복사 | Kakao JS SDK `Kakao.Share.sendDefault` (키: `NEXT_PUBLIC_KAKAO_JS_KEY`) |
| `src/components/editor/Editor.tsx` → 주소 "검색" 버튼 | 토스트만 표시 | 카카오 우편번호/로컬 API 로 주소 검색 → `venue.address`, `venue.lat`, `venue.lng` 자동 입력 |
| `src/components/invitation/MapEmbed.tsx` | 이미 구현됨 | `.env.local` 에 `NEXT_PUBLIC_KAKAO_MAP_KEY` 또는 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` 만 넣으면 동작 |

`TODO(backend)` 로 검색하면 모든 지점을 찾을 수 있습니다.

## 2. 데이터 모델

기준 타입: `src/types/invitation.ts` (`Invitation`, `GuestbookEntry`, `RsvpEntry`)

권장 테이블:

```
users            (id, provider[kakao|naver|google], provider_id, name, email, created_at)
invitations      (id, owner_id → users, slug UNIQUE, template_id, type[wedding|dol|party],
                  data JSONB  -- Invitation 전체(wedding/dol/party/venue/greeting/accounts/options/share…),
                  cover_photo, event_at, published, expires_at, created_at, updated_at)
invitation_photos(id, invitation_id, url, sort_order)
guestbook        (id, invitation_id, name, message, password_hash, created_at, deleted_at)
rsvps            (id, invitation_id, side[groom|bride|host], name, attending, count, meal[yes|no|unknown], memo, created_at)
```

## 3. API 명세

| 메서드 | 경로 | 권한 | 설명 |
| --- | --- | --- | --- |
| GET | `/api/invitations` | 로그인 | 내 청첩장 목록 |
| GET | `/api/invitations/:slug` | 공개 | 청첩장 조회 (게시된 것만) |
| PUT | `/api/invitations/:slug` | 소유자 | 생성/수정 (body: `Invitation`) — slug 중복 시 409 |
| DELETE | `/api/invitations/:slug` | 소유자 | 삭제 |
| GET | `/api/invitations/:slug/guestbook` | 공개 | 방명록 목록 (최신순, 페이지네이션) |
| POST | `/api/invitations/:slug/guestbook` | 공개 | `{name, message, password}` — password 는 bcrypt 해시 저장, 요청 제한(rate limit) 필요 |
| DELETE | `/api/invitations/:slug/guestbook/:id` | 공개+비밀번호 / 소유자 | 삭제 |
| GET | `/api/invitations/:slug/rsvp` | 소유자 | 참석 의사 목록 (+ 엑셀 다운로드: 프리미엄) |
| POST | `/api/invitations/:slug/rsvp` | 공개 | 참석 의사 등록 |
| POST | `/api/uploads` | 로그인 | 이미지 업로드 → `{ url }` |

검증 규칙 (프론트와 동일하게):
- slug: `^[a-z0-9-]{3,30}$`
- 방명록: 이름 ≤ 12자, 메시지 ≤ 300자, 비밀번호 ≥ 4자
- RSVP: 이름 ≤ 20자, 인원 1~20, 메모 ≤ 60자
- 갤러리 사진 ≤ 30장 (무료 10장 — 요금제 정책에 따라)

## 4. 환경 변수

`.env.example` 참고. 추가 예정: `NEXT_PUBLIC_KAKAO_JS_KEY`(공유), OAuth 시크릿, DB 접속 정보, 스토리지 키.

## 5. 참고

- 예시 데이터: `src/data/samples.ts` (`/i/sample-{templateId}`)
- 디자인 목록: `src/data/templates.ts` — DB 로 옮기지 않고 코드로 유지해도 됨
- 결제(요금제)는 `/pricing` 화면만 있음 — 토스페이먼츠/포트원 연동 예정

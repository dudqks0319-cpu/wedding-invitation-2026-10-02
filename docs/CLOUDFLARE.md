# Cloudflare 운영 통합

독립 공개 웹 주소는 https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site 이다. 기존 Worker `osamosam-api`, D1 `osamosam-db`, 비공개 R2 `osamosam-media`, Images binding을 재사용한다. 이 리소스 이름은 기존 앱과 배포 연결을 보존하는 내부 이름이다. 화면은 ‘청첩장’이며 상호는 미정이다.

## Sites와 기존 계정 연결

`sites/gateway.js`가 고정된 Cloudflare 주소로 요청을 전달한다. 기존 Sites의 서명 비밀값과 다른 `WEDDING_GATEWAY_SECRET`을 서버 환경에 사용한다. 클라이언트가 보낸 proxy/identity 헤더를 제거하고 메서드·경로·IP·시간을 서명한다. 20초 제한과 안전한 장애 응답을 적용한다. Worker는 검증된 새 게이트웨이에 고정된 청첩장 origin을 부여하고 새 화면·v2 API·사진 경로만 노출한다. 기존 앱 API는 새 게이트웨이에 노출하지 않는다.

새 사이트의 인증 시작은 같은 origin POST만 허용한다. 무작위 verifier/state는 10분 HttpOnly/Secure 호스트 쿠키에 저장하고 URL에는 S256 challenge를 전달한다. 기존 등록된 Google/카카오 콜백에서 인증한 뒤 기존 `native_auth_tickets`의 60초 일회용 확인값을 새 사이트로 돌려보낸다. 새 호스트는 쿠키와 state/challenge를 검증하고 확인값을 원자적으로 소모한 뒤 별도 호스트 세션을 발급한다. 확인값 재사용·외부 이동·계정 삭제 대기는 차단한다. 기존 앱 인증 경로는 그대로 유지한다.

등록 콜백은 기존 https://osamosam-app.jyb1126.chatgpt.site 의 `/auth/google/callback`, `/auth/kakao/callback`이다. 사이트 간 쿠키를 공유하지 않고, 기존 공급자 등록을 변경하지 않았다. `cloudflare/authBridge.ts`가 이 연결을 담당한다. [S256 정의](https://www.rfc-editor.org/rfc/rfc7636.html), [Google 등록 콜백 안내](https://developers.google.com/identity/protocols/oauth2/web-server).

## 빌드와 배포

1. 이 저장소에서 `npm run build:cloudflare`로 새 화면과 서버 모듈을 만든다. `npm run build:sites`는 Sites 게이트웨이를 `dist/server/index.js`에 만든다.
2. 기존 검증된 격리 런타임 `../osam-rebuild/artifacts/wedding-replacement-20261003`을 사용한다. 기존 OpenNext 런타임은 Next 16.3.7이며 이번 로그인 수정에서는 다시 설치·교체하지 않았다. 원본 checkout·환경 파일·기존 작업을 보존한다.
3. `cloudflare/build/replacement.mjs`, `cloudflare/osam-worker.template.ts`, `dist-cloudflare/index.html`을 격리 사본의 새 모듈·진입점·`replacement/index.html`에 복사한다. 기존 앱 런타임과 자산을 유지한 Wrangler 설정으로 배포한다.
4. 기존 초기 스키마는 migrations 0001~0004, 신규 자료는 `0005_replacement.sql`의 `w2_` 테이블이다. 이번 독립 사이트 인증에는 추가 migration이 없으며 기존 인증 확인값 테이블을 재사용한다.
5. Sites의 기존 청첩장 프로젝트에 서버 artifact를 저장하고 공개 게시한다. 현재 version 3과 Worker version은 [게시 기록](evidence/independent-sites-publish-20261003.json)에 있다.
6. 운영 검사는 별도 두 임시 합성 계정을 사용한다. 정리는 생성한 정확한 ID만 대상으로 한다. 이메일 없음 등 일반적인 속성으로 기존 사용자를 합성 계정이라 판단하지 않는다.

## 비용·권한·보관

- 인증 후 사진 처리. JPEG/PNG/WebP 2MiB 입력·40MP 이하, 서버 재인코딩과 메타데이터 제거, 1600px WebP·1.5MiB 이하. Images 호출 시간 8초 제한.
- 사용자 사진 100MB, 신규 전체 1GB. 처리 예약 포함, 실제 R2 삭제 후 저장량 회수. 기존 v1 사진 예산과 별개다.
- 사진 동시 처리 4건·하루 100건, R2 쓰기 2천/읽기 2만 건, 신규 API 하루 1만 건. 방문자 읽기 300/분·쓰기 12/분. 한도는 서버에서 원자적으로 적용한다. 인증 브리지는 기존 공개 쓰기 제한과 하루 전체 2천 건 제한을 적용한다.
- `w2_controls`의 `api`, `uploads` 중지 스위치 유지. 실제 운영 사진 검증 후 업로드 ON 상태를 유지했다. 이 한도는 Cloudflare 계정 전체 청구액의 보장이 아니다. 유료 요금제·기존 v1 스위치를 바꾸지 않았다.
- 초안·게시본 분리, 소유자 버전 충돌, 요청 번호·본문 HMAC 중복 검사, 동일 origin 쓰기를 적용한다. 세션은 HttpOnly/Secure 호스트 쿠키 및 해시 세션으로 저장한다.
- 사진은 현재 게시본에 참조된 경우에만 익명 조회된다. 저장소 자체는 비공개이다. 공유 중지를 즉시 반영하도록 공개 사진도 no-store를 사용한다.
- 행사일+30일 만료, 미사용 사진 24시간 후 정리. 5분 예약 작업의 bounded batch로 제거한다. 계정 삭제 대기 시 접근 차단, 실제 R2 삭제 후 용량 회수, 중복 요청 기록 정리를 적용한다.
- IP는 일별 HMAC 식별자로 저장하고 원문 IP·토큰·비밀번호를 로그에 남기지 않는다. 재시도 기록 최대 24시간, 삭제 시 정리한다.

## 증거의 범위

[실제 Cloudflare 17개](evidence/independent-production-20261003.json), [로컬 인증 16개](evidence/independent-auth-local-20261003.json), [로컬 게이트웨이 10개](evidence/independent-gateway-local-20261003.json), [실제 공급자 UI](evidence/independent-browser-20261003.json), [기존 자료 보존](evidence/independent-data-preservation-20261003.json), [보안 검사](evidence/independent-security-20261003.md)를 구분한다. 실제 Google 인증 복귀는 성공했고, 카카오는 계정 입력 화면까지 확인했다. 장기 보관·대규모 부하·앱 교체 증거는 아직 없다.

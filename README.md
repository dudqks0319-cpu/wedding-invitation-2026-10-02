# 내 사진으로 만드는 초대장

상호는 아직 정하지 않았습니다. 웹 화면에는 ‘청첩장’으로 표시합니다. 실사 AI 예시 사진 26장과 디자인 19종(청첩장 13·돌잔치 4·부모님 잔치 2)을 제공하며, 공유하기 전 내 사진으로 교체합니다.

[청첩장 웹서비스](https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site) · [이전 오삼오삼 초대장](https://osamosam-app.jyb1126.chatgpt.site/dashboard) · [현재 검증 상태](docs/current-state.md)

## 현재 배포

독립 Sites 주소에서 Cloudflare Worker의 `/api/v2/`, D1, 비공개 R2, Images를 사용합니다. 오삼오삼의 기존 계정·Google/카카오 등록·네이티브 인증·이전 초대장 API를 보존합니다. 공급자 인증 후 새 사이트에 별도 호스트 세션을 발급하므로 새 주소를 유지합니다. 이전 초대장은 기존 주소 `/dashboard`, 새 초대장은 새 주소 `/my`에서 관리합니다. 기존 iPhone/Android 앱 교체는 후속 작업입니다.

새 주소의 실제 Google 로그인·새로고침·로그아웃을 확인했습니다. 카카오는 실제 계정 입력 화면까지 확인했으며 최종 공급자 콜백은 미검증입니다. 실제 Cloudflare 운영 검사 17개 통과와 검증 범위는 [현재 상태](docs/current-state.md)에 기록했습니다.

작성자만 초안을 읽고 수정할 수 있습니다. 공유 시작·공유 내용 업데이트를 누르면 별도 스냅샷이 공개됩니다. 공유 중지는 페이지와 사진 접근에 즉시 반영됩니다. RSVP 명단은 작성자 전용이며 방명록은 승인 후 공개됩니다. 현재 무료 시험 운영이며 결제·BGM·네이버 로그인은 제공하지 않습니다.

## 로컬 실행과 검증

```sh
npm ci
npm run dev                 # 브라우저에 저장되는 로컬 미리보기
npm run build:preview       # 한 파일 로컬 미리보기
npm run build:cloudflare    # 서버 연결 화면과 Worker 모듈 생성; 배포하지 않음
npm run build               # 별도 Next 개발 빌드 검증
npm run lint
```

```sh
OSAM_TOOLCHAIN=/path/to/osam-rebuild/node_modules npm run test:cloudflare
node tests/session-boundary.mjs
OSAM_TOOLCHAIN=/path/to/osam-rebuild/node_modules node tests/auth-bridge.integration.mjs
OSAM_TOOLCHAIN=/path/to/osam-rebuild/node_modules node tests/site-gateway.integration.mjs
```

Cloudflare 검사는 기존 오삼오삼 도구에 설치된 Miniflare·sharp를 사용합니다. 실제 로컬 D1/R2, 이미지 디코딩, 두 계정 권한, 게시·취소, 동시 저장, 만료·삭제·용량 회수 40개를 검사합니다. `--serve`를 지정하면 합성 계정만 사용하는 로컬 확인 서버가 4180번에 열립니다.

운영 서비스 점검은 `tests/cloudflare.production.mjs`에 분리했습니다. `SITE_ORIGIN`으로 새 주소 또는 기존 주소를 선택합니다. 권한 있는 Wrangler와 이미 빌드된 기존 런타임 사본이 필요하며, 합성 계정·초대장·사진을 생성하고 정확한 생성 ID만 제거하므로 명시적인 운영 점검 때만 실행합니다. 운영 공급자 로그인은 이 테스트와 별개로 확인합니다.

## Cloudflare 소스와 통합

- `cloudflare/application.ts`, `service.ts`, `security.ts`, `photos.ts`: 새 화면·API·세션 권한·사진 저장·정리.
- `cloudflare/authBridge.ts`: 기존 공급자 등록과 새 호스트 세션을 연결하는 일회용 인증 확인값.
- `cloudflare/migrations/0005_replacement.sql`: 기존 데이터에 영향을 주지 않는 새 `w2_` 테이블.
- `cloudflare/osam-worker.template.ts`: 기존 오삼오삼 OpenNext 런타임에 새 모듈을 연결하는 진입점. 기존 로그인·앱 API의 소스와 자산은 기존 체크아웃에서 빌드합니다.
- `scripts/build-cloudflare.mjs`: `dist-cloudflare`와 `cloudflare/build/replacement.mjs` 생성.
- `sites/gateway.js`, `scripts/prepare-sites.mjs`: 새 Sites 주소를 유지하는 서버 게이트웨이와 게시 산출물 준비. 비밀값은 서버 환경에서만 읽습니다.

이 저장소의 기존 Supabase/Next API는 초기 구현 기록이며 현재 운영 백엔드로 배포하지 않습니다. 운영 통합과 한도는 [Cloudflare 안내](docs/CLOUDFLARE.md), 결과는 [현재 상태](docs/current-state.md)에서 확인하세요. 비밀값은 기존 Cloudflare/Sites 설정에 유지하며 소스·산출물에 넣지 않습니다.

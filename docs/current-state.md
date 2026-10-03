# 청첩장 웹서비스 현재 상태

2026-10-03. 상호 미정. 사용자 결정: **웹서비스 먼저 완성, iPhone/Android 앱은 이후 교체**. 화면 이름은 ‘청첩장’이다.

## 현재 배포와 수정 결과

- 독립 공개 사이트: https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site . 기존 청첩장 Sites 프로젝트를 재사용하여 실제 서버 게이트웨이를 게시했다. 오삼오삼 홈페이지로 보내던 리디렉션을 제거했다.
- Sites project `appgprj_6abf84676b4881918d32542f0e76190c`, version 3, 게시 성공. 배포 소스 commit `cf6a6724ea37b6df0814673154e4028e2aaf3578`. [게시 영수증](evidence/independent-sites-publish-20261003.json).
- Cloudflare Worker `osamosam-api`, version `8e347f0b-3708-4ae9-b08f-297e526eeba5`, 기능 이식 소스 `bff9ae13cab0e571ca218dc69320cd452c14101e`. 기존 D1 `osamosam-db`, 비공개 R2 `osamosam-media`, Images binding을 사용한다. 신규 자료는 `w2_` 테이블과 `w2/` 경로를 사용한다. [최신 배포 영수증](evidence/osam-import-20261003/deploy.json). Sites version 3 게이트웨이는 그대로 사용하고 Worker/프런트 산출물만 갱신했다.
- 기존 오삼오삼 OAuth 등록·계정·앱 인증·이전 API·원본 checkout을 보존했다. Google/카카오 인증은 기존 등록 주소를 경유하고, 일회용 확인값으로 새 사이트에 별도 세션을 발급한다. 쿠키는 각 호스트에 한정된다.
- 인증 상태와 무관하게 표시되던 상단 로그인·본문 로그아웃을 수정했다. 익명은 로그인 안내, 인증 완료는 ‘내 계정’·‘로그인됨’·로그아웃을 표시한다. 확인 중 또는 연결 실패 시 비공개 화면을 가린다.
- 새 초대장은 새 주소 `/my`, 이전 초대장은 기존 주소 `/dashboard`에서 관리한다. 이전 자료 자동 가져오기나 삭제는 실행하지 않았다.
- 공개 GitHub: https://github.com/dudqks0319-cpu/wedding-invitation-2026-10-02 . 기존 main 이력을 유지한다. 배포 소스와 후속 문서·증거를 이 저장소에 기록한다.

## 확인한 증거

- **실제 Google OAuth**: Codex 내장 브라우저에서 새 사이트 버튼 → 공급자 인증 → 새 주소 `/my` 복귀 성공. 새로고침 후 인증 유지, 상단 ‘내 계정’, 본문 ‘로그인됨’ 확인. 로그아웃 뒤 `/login` 복귀와 다시 Google 로그인 성공을 확인했다. [데스크톱 화면](evidence/independent-login-desktop.png), [브라우저 기록](evidence/independent-browser-20261003.json). 사용자가 첨부한 Aside 브라우저는 별도 프로필이며 이 기록으로 그 프로필까지 검증했다고 주장하지 않는다.
- **실제 Cloudflare 17개 PASS**: 새 Sites 경유 Worker/D1/R2/Images, 두 임시 계정 격리, 인증 확인값 발급·재사용 차단, 초안 멱등 저장, 외부 origin 차단, 실사진 변환·업로드, 비공개 사진 차단, 공유·OG·RSVP·승인형 방명록, 만료·공유 중지·삭제·용량 회수. [운영 검사](evidence/independent-production-20261003.json). 공급자 로그인은 합성 인증 테스트와 별도로 검증했다.
- **기존 자료 보존**: 점검 전후 사용자 3명, 이전 초대장 0개가 동일했다. 이번 두 임시 계정과 세션·인증 확인값·초대장은 정리 후 0개이다. 이메일 없는 기존 사용자 1명을 합성 사용자로 취급하지 않는다. [집계 기록](evidence/independent-data-preservation-20261003.json).
- **로컬 검사**: 기존 Cloudflare 회귀 40개, 새 인증 브리지 16개, 게이트웨이 10개, 세션 경계 6개 시나리오 PASS. D1/R2·실제 디코더·workerd 검증과 Sites의 mock fetch 검증 범위를 기록에 구분했다. [인증](evidence/independent-auth-local-20261003.json), [게이트웨이](evidence/independent-gateway-local-20261003.json), [회귀 로그](evidence/independent-regression-local.log).
- **이전 배포 빌드·보안**: TypeScript·lint·Next 빌드·Cloudflare 빌드·Wrangler dry-run 성공. 게시 입력과 Worker 산출물 177개 텍스트 경로 비밀값 패턴 발견 0. 당시 audit 취약점 0. 현재 기능 이식의 최신 audit과 범위는 [통합 보안 검사](evidence/osam-import-20261003/SECURITY.md)에 별도 기록한다.
- 실사 AI 예시 26장·디자인 19종 유지. AI 예시를 그대로 실제 게시하는 것은 차단한다. 초안·게시본 분리, 버전 충돌, 승인형 방명록, 작성자 전용 RSVP, 공유 중지 즉시 차단을 유지한다.

## 남은 범위와 제한

2026-10-03 모바일 점검: iPhone 17 / iOS 26.5 Safari 시뮬레이터에서 예시 청첩장·갤러리·사진 확대와 이동·연락처 창·Safari 공유 메뉴 확인. IAB 320·390·430px에서 편집기 공유 카드의 가로 넘침을 수정·게시하고 공개 사이트에서 재검증했다. 기존 로그인 세션의 모바일 메뉴·내 청첩장 표시와 이름 수정 미리보기 반영도 확인했다. [모바일 캡처·범위·재개 기준](evidence/mobile-share-20261003/STATUS.md).

실제 iPhone Safari는 Face ID 잠금, Mac 카카오톡은 로그인 대기다. PlayMCP ‘나와의 채팅’으로 AI 예시 링크를 한 번 전송했고 커넥터가 성공을 반환했다. 실제 대화방 링크 카드·카카오 인앱 브라우저·Android 화면은 아직 미검증이다. 공유 제목·대표 사진의 익명 HTTP 200과 편집기 공유 카드 캡처를 실제 카카오 화면 증거로 해석하지 않는다. 하객에게 메시지를 보내지 않았다.

카카오는 **새 사이트 버튼에서 실제 카카오 계정 입력 화면까지 확인**했다. 본인 인증 입력 없이 종료했으므로 최종 공급자 콜백은 아직 미검증이다. Google과 카카오의 검증 범위를 혼동하지 않는다.

현재 무료 시험 운영. 계정별 사진 100MB, 신규 전체 1GB, 하루 사진 변환 100건 등 서버 한도와 중지 스위치를 유지했다. 기존 v1 예산·스위치와 요금제는 바꾸지 않았다. 실제 장기 보관·만료 경과, 대규모 부하, 계정 전체 청구 비용은 장기 관측이 필요하다. 결제·네이버·BGM은 제공하지 않는다.

5분 예약 정리 트리거는 기존 배포에 유지된다. 로컬 자동 정리 및 운영 테스트 자료의 만료 차단 검증은 실제 30일 경과 검증과 다르다. iOS/Android 앱 교체·배포·실기기 검증은 후속 범위다.

공통 release harness는 ATTENTION: `release-ledger.yaml`·`RELEASE_STATUS.md`가 없다. 웹 검증 결과를 App Store 출시 준비 완료로 해석하지 않는다.

## 재개 기준

2026-10-03 오삼오삼 기능 이식 완료: 주소 선택·사진 위치/확대/맞춤·글꼴·한국 시간 일정 파일·디자인 검색/브라우저 찜을 구현·게시했다. 주소 iframe 포커스 때문에 비공개 화면을 가리던 기존 오류도 수정했다. 기능 9개·Cloudflare 41개·기존 Next 백엔드 28개·인증 16개·세션 시나리오 6개와 포커스 4개, lint/TypeScript/Next/Cloudflare 빌드·Wrangler dry-run 통과. 모바일 브라우저 320/390/430px 저장/재열기·주소 선택·일정 다운로드 확인. 실제 새 Sites 경유 Cloudflare 운영 20개 PASS, 점검 전후 기존 사용자 3명·세션 6개 및 이전/신규 초대장·사진 집계 동일, 이번 임시 자료 0. 공개 UI에서 주소 iframe 검색·새 도구 표시·검색/찜 재열기·실제 일정 파일 다운로드를 확인했다. 원본 참고 파일 7개 지문은 배포 후 동일하다. [상세 증거](evidence/osam-import-20261003/STATUS.md).

[Cloudflare 구조](CLOUDFLARE.md), [수정 전 기록](history/20261003-before-independent-site.md), [초기 상태](history/20261003-before-cloudflare.md)를 보존했다. 현재 운영 백엔드는 Cloudflare이다.

재개: “docs/current-state.md와 docs/CLOUDFLARE.md를 읽고 독립 청첩장 사이트와 기존 오삼오삼 계정을 보존하면서 후속 작업을 진행해줘. 이름은 아직 미정이야. 카카오는 최종 계정 인증을 별도로 검증해줘.”

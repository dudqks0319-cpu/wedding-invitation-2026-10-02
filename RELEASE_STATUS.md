# 청첩장 iOS / 이미지 공개 상태

2026-10-03. 별도 앱 **청첩장 0.1.0 (2)**를 본인 App Store Connect에 업로드했다. 업로드 성공과 TestFlight 처리·테스터 접근·실기기 설치는 별개이다.

새 실사 AI 사진 2종, Opus 소개페이지 및 실제 화면을 넣은 세로 소개 JPG 3장을 Cloudflare에 배포했다. Sites는 기존 공개 버전 3 게이트웨이를 사용하며 정책이 `public`임을 재확인했다. 배포 소개페이지와 새 사진·캡처 이미지는 실제 브라우저에서 표시됐다. 일반 HTTP 직접 조회는 403, 브라우저 JSON 경로 탐색은 클라이언트 차단으로 추가 운영 API 검증을 증명하지 못했다.

로컬 검증 81건, 타입·린트·웹/Cloudflare 빌드, 개인정보·인증·비밀값·쿼터 게이트, IPA 서명과 iPhone 화면 방향 검증은 통과했다. Apple 첫 업로드는 방향 누락으로 거부되어 설정을 수정하고 빌드 2를 만들었으며, 빌드 2 업로드는 성공했다.

Apple 처리 `VALID`, 내부 배포 `IN_BETA_TESTING`, 본인 그룹 빌드 2 연결, 테스터 1명 `INVITED`를 API와 실제 UI로 확인했다.

**HOLD**: 요청된 iPhone 16 Pro는 `unavailable`이므로 해당 기기의 TestFlight 설치·실제 OAuth 로그인은 미검증이다. 기존 연결된 iPhone 12 Pro에는 대신 설치하지 않았다. App Store 공개 출시 준비 완료로 보고하지 않는다.

작업 재개: `docs/ios-current-state.md`와 `release-ledger.yaml`을 읽고 새 앱의 처리 및 기기 상태를 확인한다. 기존 오삼오삼 앱/계정/데이터를 변경하지 않는다.

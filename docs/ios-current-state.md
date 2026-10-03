# 청첩장 iOS TestFlight 작업

2026-10-03. 사용자 요청: 현재 독립 청첩장 웹서비스를 TestFlight에 업로드하고 **iPhone 16 Pro**에 설치한다.

- 웹 기준 소스: `35f45c5`; 기존 웹·오삼오삼 앱·개인 자료 보존.
- `ios/`에 별도 SwiftUI/WebKit 앱을 구현했다. 새 운영 의존성은 추가하지 않았다.
- 표시 이름은 임시 `청첩장`. 별도 앱으로 등록했다: `com.invitehub.wedding-preview`, ASC `6818721229`, 0.1.0 (2). 기존 오삼오삼 앱은 보존했다.
- 기존 Apple Development/Distribution 인증서와 팀 API 키 존재를 확인했다. 비밀값은 저장소·로그에 기록하지 않는다.
- Xcode 기기 조회: iPhone 12 Pro connected, 요청 대상 iPhone 16 Pro unavailable. 다른 기기에 대신 설치하지 않는다.
- 기존 Chrome 인증으로 새 Apple 앱·번들·프로파일을 등록했다. 기존 Apple Distribution 인증서로 아카이브/IPA를 생성하고 서명을 검증했다.

완료: Swift 7 / WebKit 4 / 네이티브 D1 인증 13 / 웹 인증 16 / Cloudflare 41 검증 통과. 타입·린트·Next·Cloudflare 빌드 통과. 마지막 Next 재빌드의 캐시 오류는 기존 `.next`를 임시 위치에 보존하고 재생성해 해결했다. iOS 생성물은 타입 검사에서 제외했다.

사진 2종을 imagegen으로 개선했고, Claude Code Opus가 만든 소개 HTML에 직접 검증한 화면 4개를 삽입했다. 소개 JPG 3장(1242×2688), 모바일 가로 넘침·이미지·키보드 디자인 탭을 확인했다. 보안 게이트 및 비공개 자료 제외를 확인했다.

남은 작업: TestFlight 업로드 → Apple 처리·본인 내부 테스트 접근 → iPhone 16 Pro TestFlight 설치·로그인 실행. Cloudflare 새 이미지/소개페이지 배포와 운영 읽기 검증, GitHub 소스 반영도 이어서 수행한다. 기기가 연결되지 않으면 실기기 항목은 HOLD로 유지한다.

수용 기준: 네이티브 웹·외부 링크·공유/일정 파일·로그인 보안 검사, 서명 아카이브/IPA, 업로드 영수증, Apple 처리 및 본인 테스트 접근, 요청된 기기의 TestFlight 설치 버전·실행 증거. App Store 공개 심사는 요청 범위가 아니다.

진행: 네이티브 로그인은 시스템 인증 브라우저와 PKCE 일회용 티켓을 사용하고 새 사이트 호스트에만 세션을 발급하도록 추가한다. 이전 브라우저/오삼오삼 인증 경로는 유지한다. 로컬/시뮬레이터/서명/업로드/처리/실기기 증거를 각각 기록한다.

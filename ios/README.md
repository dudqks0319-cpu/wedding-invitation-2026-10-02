# 청첩장 iOS

별도 앱 `com.invitehub.wedding-preview` / 표시 이름 `청첩장` / 0.1.0 (2).
App Store Connect 앱 ID: `6818721229`. 기존 오삼오삼 앱을 교체하지 않는다.

SwiftUI와 WebKit으로 독립 사이트를 연다. 홈·디자인·내 초대장, 공개 초대장 공유, 외부 링크, 파일 공유, 시스템 인증 브라우저를 통한 PKCE 로그인을 지원한다. 인증 콜백에 세션 토큰을 싣지 않고 단회 티켓을 웹뷰에서 교환한다. 웹에서 받은 로그인 요청은 신뢰하는 호스트의 주 프레임에 한정한다.

```sh
xcodegen generate --spec ios/project.yml
swift test --package-path ios
xcodebuild -project ios/WeddingInvitation.xcodeproj -scheme WeddingInvitation \
  -destination 'platform=iOS Simulator,id=94D07B38-4888-441F-AE1D-BFBCB8AE99A3' \
  -parallel-testing-enabled NO -maximum-concurrent-test-simulator-destinations 1 \
  -maximum-parallel-testing-workers 1 test
```

새 런타임 의존성은 없다. 기존 Apple 서명 인증서로 아카이브·IPA를 만들었다. API 키는 기존 비공개 메타데이터에서 읽으며 비밀값을 출력하지 않는다. 프로파일, 개인 자료, IPA, 빌드 로그, Xcode 프로젝트 생성물은 Git에서 제외한다.

로컬 Swift 7건, 실제 WebKit 4건, D1 인증 13건, 웹 인증 16건, Cloudflare 회귀 41건이 통과했다. 실제 Google/카카오 로그인과 iPhone 16 Pro의 TestFlight 설치는 별도 검증 항목이다. 현재 상태는 `docs/ios-current-state.md` 및 루트 릴리스 원장을 기준으로 한다.

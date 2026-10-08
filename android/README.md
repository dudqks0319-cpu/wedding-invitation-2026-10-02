# Android 출시 준비 후보

이 청첩장 서비스의 독립 Android 후보다. 이름은 임시로 `청첩장`, 식별자는 `com.invitehub.weddingpreview`다. 오삼오삼 앱·키·사용자 자료를 교체하지 않는다.

## 구현한 범위

- 고정 HTTPS 사이트의 WebView, 홈/디자인/내 청첩장 이동, 플랫폼 뒤로 가기와 오류 재연결.
- 카카오/Google 시스템 브라우저 로그인 시작과 PKCE·state·10분 만료·일회용 서버 티켓의 콜백/세션 연결. 실제 제공사 왕복은 별도 검증 대상이다. Android Apple 로그인과 Play Billing은 구현하지 않았다.
- 시스템 사진 선택(단일 사진, 확인 가능한 크기 40MB 이하), PNG/JPEG/CSV/ICS/PDF 내보내기와 시스템 공유. 앱의 광범위 사진·저장소 권한은 요청하지 않는다. 선택한 URI만 현재 문서/세션에 전달하며 영구 접근 권한을 저장하지 않는다.
- 정확한 메인 프레임 오리진/문서 nonce/채널 세대 제한. `addJavascriptInterface`는 사용하지 않는다. 다른 오리진은 자바스크립트 네이티브 권한을 받지 않는다.
- 공유 파일은 앱 캐시에 최대 3개·각 10MB·10분, UUID 이름과 임시 읽기 권한으로만 전달한다. 삭제/세션 변경 시 캐시와 URI 권한을 정리한다. 이미 상대 앱이 받은 자료를 원격 삭제하는 기능은 아니다.
- 쿠키는 고정 호스트의 HttpOnly/Secure 세션만 저장한다. 로그인 비밀번호·제공사 토큰/콜백 원문을 로그나 파일에 기록하지 않는다. HTTP·TLS 오류 우회와 앱 데이터 백업은 차단한다.

## 기존 도구로 실행

```sh
python3 android/scripts/test_policy.py
node android/tests/bridge.mjs
python3 android/scripts/build.py
```

`build.py`는 설치된 SDK36/build-tools36.1.0, 캐시 Gradle8.14.3/AGP8.12.0/JDK17만 `--offline`으로 사용한다. 다운로드·패키지 설치·서명 키 발급·스토어 업로드를 하지 않는다. 순차 빌드·린트 로그와 시각/산출물 지문은 `android/.build/`에 남긴다. 기기 검증과 빌드 작업은 순차로 진행한다.

- APK: `android/app/build/outputs/apk/debug/app-debug.apk` (로컬 검증용 debug 서명)
- AAB: `android/app/build/outputs/bundle/release/app-release.aab` (**서명하지 않은 출시 준비 산출물**)
- 현재 근거: [Android 검증 원장](../docs/evidence/store-release-20261007/ANDROID.md), [추가 서명 근거](../docs/evidence/store-release-20261007/ANDROID_SIGNING.md)

## 검증된 AAB에 별도 업로드 키 서명

```sh
python3 android/scripts/sign_bundle.py
```

이 선택 단계는 기존 JDK17만 사용하며 앱을 다시 빌드하거나 업로드하지 않는다. 현재 빌드의 근거 `docs/evidence/store-release-20261007/android-candidate-local.json`와 AAB/소스 지문이 일치해야 실행한다. 새 후보에서는 새 실제 빌드 근거를 먼저 기록한다.

독립 로컬 업로드 키가 없을 때 생성하며, 이후에는 같은 키/인증서를 검증해 재사용한다. 키와 암호는 `android/private/`의0700/0600·Git 제외 경로에 보존한다. 외부 업로드/Google 키 등록/기존 오삼오삼 키 교체는 하지 않는다. 별도 산출물은 `android/.build/signed/wedding-invitation-0.1.0-1-upload.aab`다. 로컬 인증서를 신뢰 기준으로 한 strict 서명 검증 종료0과 기존 앱 ZIP 바이트 보존을 확인했다. 자체 서명 경고가 있으며 Play 준비 완료로 해석하지 않는다.

## 공개 제출 보류

APK/AAB 생성은 스토어 출시 가능 또는 실제 Android 기기 성공을 뜻하지 않는다. 같은 후보의 실제 로그인→사진 저장→수정→카카오 수신→삭제, 오류/세션 복구, 구매/복원/환불은 미검증이다. Play 계정·App Signing·최종 이름/상품/지원·Data safety/삭제 URL·Android 스크린샷·심사 접근·결제/서버 운영·제공사 비용 방어가 남는다. 새 유료 기능은 비활성이다. 원본 AAB는 unsigned이고 별도 AAB에 로컬 업로드 키 서명이 있다. Play 앱/키 등록 및 실제 사용 검증 전 공개 제출하지 않는다.

Android 플랫폼 문서: [WebView 메인 프레임 메시지](https://developer.android.com/reference/android/webkit/WebView), [플랫폼 뒤로 가기](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture), [AGP8.12 도구 조건](https://developer.android.com/build/releases/agp-8-12-0-release-notes).

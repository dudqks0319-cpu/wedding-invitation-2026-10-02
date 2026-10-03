# 모바일 화면·카카오 공유 점검

2026-10-03 KST. 공개 사이트: https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site . AI 예시 청첩장 `/i/sample-blossom`으로 확인했다. 실제 하객 연락·메시지 전송은 하지 않았다.

## 확인한 범위

- **iPhone 17 / iOS 26.5 Safari 시뮬레이터**: 디자인 상세와 공개 예시가 로드되었다. 대표 사진·한글 문구, 갤러리, 사진 확대·다음 사진·닫기, 연락처 창 열기·닫기 정상. 전화·문자는 발신하지 않았다. `simulator-invitation-cover.png`, `simulator-photo-viewer.png`, `simulator-contact-dialog.png`은 실제 Safari 캡처다.
- **Safari 기본 공유 메뉴**: 예시 URL의 제목과 기본 공유 메뉴를 확인했다. `simulator-share-sheet.png`은 Safari 메뉴에서 연 화면이다. 시뮬레이터에 카카오톡이 없어 카카오톡 수신 화면이나 사이트 공유 버튼의 완료 증거로 취급하지 않는다.
- **브라우저 모바일 폭**: 320·390·430px에서 예시 청첩장의 가로 넘침·깨진 이미지가 없었다. 편집기의 이름 수정이 미리보기에 반영되고 원래 이름으로 되돌렸다. 로그인된 `/my`와 모바일 메뉴의 ‘로그인됨’·‘내 계정’ 확인. Google 인증 세션은 기존 IAB 프로필의 것으로, 모바일 Safari 신규 OAuth 완료와 다르다. 서버 초안 저장·사진 업로드·실제 공유 시작은 이번 모바일 UI 점검에서 실행하지 않았다.
- **작은 화면 수정**: 편집기 카드의 고정 `w-64`를 `w-full max-w-64`로 변경했다. 320px에서 `clientWidth=305`, `scrollWidth=314`였던 것이 305/305가 되었다. 로컬과 공개 사이트에서 세 폭 모두 넘침 0, 깨진 이미지 0을 확인했다. [측정](browser-layout.json).
- **링크 메타데이터**: 로그인 없는 HTML·대표 WebP 사진 모두 HTTP 200. 서버 제목 ‘김민준 ♥ 이서연 결혼합니다’, 설명 ‘AI 예시 사진을 사용한 디자인 미리보기’, 절대 사진 URL 확인. [서버 기록](public-og.json). 카카오톡 캐시·대화방 렌더링은 별도 미검증이다.

## 카카오톡 화면의 구분과 남은 확인

`editor-share-preview.jpg`은 **사이트 편집기의 공유 미리보기**다. 실제 카카오톡 대화방 캡처가 아니다. 현재 운영 프런트엔드에는 Kakao JavaScript 키가 없어 사이트의 공유 버튼은 지원 브라우저의 `navigator.share`를 사용하고, 미지원 브라우저에서는 링크를 복사한다. 실제 링크 카드의 제목·사진 형식과 ‘청첩장 보기’ 버튼 유무를 이 편집기 화면만으로 보장하지 않는다.

연결된 실제 iPhone의 Safari는 Face ID 잠금 화면에서 대기했다. 잠금을 우회하지 않았다. Mac 카카오톡도 로그인 화면이므로 실제 전송은 하지 않았다. 사용자에게 Safari 잠금 해제와 공개 예시 링크를 ‘나와의 채팅’에 1회 보내는 허용 여부를 질문한 상태다. Android 및 카카오톡 인앱 브라우저는 아직 미검증이다. 중간에 기본 시뮬레이터가 다른 앱 작업으로 전환되어 추가 조작을 멈췄다.

## 배포·검사

- 수정 소스 commit `674c3402a8584217b59a847448469bec023be356`, GitHub main에 push 완료.
- Cloudflare Worker version `f7084ac8-6c06-4493-9b39-20334350dc74`, Wrangler 성공. 변경 자산은 `/replacement/index.html` 1개. 기존 Worker 진입점·서버 모듈은 byte-identical이며 D1·R2·Images·5분 트리거·인증·한도·요금제를 변경하지 않았다. Sites 게이트웨이 version 3은 그대로 유지된다. [배포 로그](cloudflare-deploy.log).
- TypeScript, 전체 lint, Next 빌드, Cloudflare 빌드, Wrangler dry-run 성공. CSS 한 줄 변경이며 새 의존성·백엔드 동작 변경이 없어 기존 인증·DB 회귀 검사를 반복하지 않았다. 공통 release harness는 기존 앱 출시 문서 없음으로 ATTENTION이며 App Store 준비 완료를 주장하지 않는다.
- 통합 보안 gate: 비밀값 패턴 scan과 캡처 개인정보 검토, 권한·입출력·예산 동작의 무변경 지문 확인. 의존성 파일은 무변경이며 이전 audit 결과 0을 재사용했다. [지문·scan](security.json). 정규식 검사는 비밀값 부재의 절대 보증이 아니다.

재개: Safari Face ID 해제 후 실제 iPhone에서 동일 예시 링크를 확인한다. 카카오톡 로그인·‘나와의 채팅’ 전송 허용이 확인되면 준비한 공개 예시 메시지 1개만 보내고, 링크 카드와 눌러 열리는 청첩장을 각각 캡처한다. 다른 사람에게 보내거나 사용자 사진을 새로 공개하지 않는다.

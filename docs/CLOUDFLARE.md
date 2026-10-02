# Cloudflare 운영 통합

현재 서버: 기존 Worker `osamosam-api`, D1 `osamosam-db`, R2 `osamosam-media`, Images binding. 웹의 정식 진입 주소는 기존 Sites 게이트웨이이며 이전 청첩장 Sites 주소도 여기로 연결한다. 신규 상호와 도메인 변경은 미확정이다.

## 빌드와 배포 구조

1. 이 저장소에서 `npm run build:cloudflare`로 새 화면과 서버 모듈을 만든다.
2. 기존 오삼오삼의 검증된 release source를 새로운 격리 사본에 복사한다. 원본 checkout·환경 파일·작업 중 변경은 보존한다. 현재 사본은 `../osam-rebuild/artifacts/wedding-replacement-20261003`이다.
3. 기존 OpenNext 로그인·네이티브 API를 **Next 16.3.7**로 빌드한다. 현재 작업에서는 이 저장소에 이미 설치된 수정 버전을 사용했으며 설치·유료 플랜 변경은 없었다. 새 모듈과 wrapper는 `cloudflare/`, 새 HTML은 `.open-next/assets/replacement/index.html`, 예시 사진은 assets의 `/photos/`에 복사한다.
4. 기존 D1에 `0005_replacement.sql`을 적용한다. 초기 사용자/세션/이전 초대장 스키마는 기존 오삼오삼 migrations 0001~0004가 제공한다. 기존 테이블·OAuth·네이티브 등록·비밀값을 재생성하지 않는다.
5. 기존 wrangler 설정으로 같은 Worker에 배포한다. 기존 Sites 게이트웨이의 서명 검증을 유지한다. 새 frontend/API가 처리하지 않는 경로는 기존 런타임으로 전달한다.
6. 원격 통합 검사, 공급자 로그인, 원본 계정 수 보존과 테스트 자료 정리를 확인한다. 운영 점검 스크립트는 일시적인 합성 계정을 만들며 실제 사용자 자료를 지우지 않는다.

## 비용·권한·보관

- 인증 후 사진 처리. JPEG/PNG/WebP 2MiB 입력·40MP 이하, 서버 재인코딩과 메타데이터 제거, 1600px WebP·1.5MiB 이하. Images 각 호출 시간 8초 제한.
- 사용자 사진 100MB, 신규 사진 전체 1GB. 처리 중 예약도 포함하며 실제 R2 삭제 후에만 저장량을 회수한다. 기존 v1 사진 예산과는 별개다.
- 사진 처리 동시 4건·하루 100건, R2 쓰기 2천/읽기 2만 건, 신규 API 하루 1만 건. 방문자 읽기 300/분·쓰기 12/분. 한도는 서버에서 원자적으로 적용한다.
- `w2_controls`의 `api`, `uploads` 중지 스위치를 사용한다. `uploads`는 기본 OFF, 실제 운영 사진 검증 이후 ON이다. 신규 API의 한도이며 Cloudflare 계정 전체 요금이나 무료 플랜 적합성을 보장하지 않는다. 비용 플랜 변경은 하지 않았다.
- 초안·게시본 분리, 소유자 버전 충돌 검사, 요청 번호·본문 HMAC 중복 검사, 동일 origin 쓰기만 허용한다. 세션은 기존 HttpOnly/Secure 쿠키와 해시 세션을 사용한다.
- 공개 사진은 현재 게시본에 참조된 경우에만 조회된다. 저장소 자체는 비공개다. 공유 중지에 즉시 반응하도록 공개 사진에도 no-store를 적용한다.
- 새 자료는 행사일+30일 만료, 미사용 사진은 24시간 후 정리. 5분 예약 작업에서 bounded batch로 제거한다. 계정 삭제 대기 시 새 자료 접근을 즉시 차단하고 기존 계정 정리보다 새 사진 정리를 먼저 수행한다. 삭제된 초대장과 계정의 중복 응답 기록도 제거한다.
- IP는 일별 HMAC 식별자로 한도를 적용하며 원문 IP·토큰·비밀번호를 로그에 남기지 않는다. 요청 재시도 기록은 최대 24시간 보관하고 삭제 때 정리한다.

## 운영 증거의 범위

[로컬 40개](evidence/cloudflare-local-20261003.json), [실제 Cloudflare 점검](evidence/cloudflare-production-20261003.json), [산출물 지문](evidence/cloudflare-artifact-20261003.json), [보안 검사](evidence/security-cloudflare-20261003.md)를 분리해 기록한다. 테스트의 두 계정은 합성 계정이며 공급자 OAuth 성공과 구분한다. 자동 만료의 로컬 검증은 실제 장기 보관 및 운영 부하 관측을 대신하지 않는다.

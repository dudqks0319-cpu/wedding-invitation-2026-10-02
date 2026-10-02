# 봄결 현재 작업 상태

2026-10-02. 원본 GitHub HEAD: `6cead052dec70f9b4434e026dc271545bd62cc70`.

## 완료한 구현

- 기존 19종 디자인에 실사 AI 예시 사진 26장 적용. 가상 인물임을 안내하고 실제 사진으로 교체 가능. 최대 사진 216KiB, 합계 약 2.3MiB WebP.
- Next 서버에 저장·초안·게시·카카오/구글 PKCE·비공개 사진·방명록·RSVP API, 입력·소유권·해시·CSRF·한도·중복 방지 구현.
- 새 운영 패키지 없이 기존 Next/Node와 Supabase HTTP API 사용. 기존 의존성 lockfile 유지.
- Sites는 현재 소유자 전용 정적 편집 미리보기로 구성. 내용은 그 브라우저에만 보관하며 하객 공유는 비활성화. 새로고침·뒤로가기 지원.

## 확인한 증거

- 모바일 375×812에서 19종 표지 사진 로딩·화면 넘침 검사 통과. 표지 캡처와 전체 비교 이미지를 `docs/evidence/`에 보관.
- 실제 브라우저에서 사진 선택·신랑 이름 변경·저장·내 청첩장 목록 확인. `editor-saved.jpg`.
- 로컬 Sites 산출물에서 편집·저장·새로고침 복원, 유효/무효 WebMCP 도구 검증 통과. `sites-preview-qa.json`.
- TypeScript, Next webpack production build, preview build 및 백엔드 HTTP fixture 28개 통합 검사 완료 기록. 마지막 검증 결과는 `verification.json` 참고.
- npm audit 알려진 취약점 0개. lint 기존 미리보기 shim의 미사용 변수 경고 2개, 오류 없음.

## 배포

- GitHub: `https://github.com/dudqks0319-cpu/wedding-invitation-2026-10-02` (비공개). 업로드 커밋·상태는 `docs/evidence/deployment.json` 확인.
- Sites ID: `appgprj_6abf84676b4881918d32542f0e76190c`. 소유자 전용 배포 성공, 배포 상태는 `docs/evidence/deployment.json` 확인.
- Sites: https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site — `succeeded`, 배포 소스 `2862fb3555a7a320af5b63459c3858f4a5aed73d`.
- Sites 배포는 미리보기 산출물이고 Next API 서버 배포 증거가 아닙니다.

- 통합 release harness: ATTENTION (공통 release-ledger.yaml·RELEASE_STATUS.md 없음). 실제 백엔드 release-ready 주장 없음. 프로젝트 상태는 이 문서가 관리함.

## HOLD: 실제 백엔드 연결

Supabase 프로젝트 선택과 비용 확인 응답이 아직 없습니다. 다른 앱의 프로젝트는 읽기만 했으며 변경하지 않았습니다. 실제 마이그레이션·RLS 실행, 실제 공급자 로그인, 두 계정 격리, 실제 서버 저장·하객 공유·비용 관측은 확인되지 않았습니다. 로컬 Docker 실행 환경도 사용할 수 없어 SQL 테스트는 미실행입니다. [연결 절차](BACKEND_SETUP.md).

## 다음 작업과 재시작

소유자가 Supabase 프로젝트를 선택하고 비용을 확인하면 새 전용 프로젝트에 마이그레이션과 `tests/rls.sql`을 적용하고, 원격 Next 서버·공급자 설정을 연결합니다. 기존 Sites ID와 GitHub 저장소를 재사용합니다. 재시작 요청: “docs/current-state.md를 읽고 봄결의 실제 Supabase·OAuth·서버 저장 연결을 마무리해줘.”

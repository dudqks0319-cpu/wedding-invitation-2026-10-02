# 봄결 현재 작업 상태

2026-10-03. 원본 GitHub HEAD: `6cead052dec70f9b4434e026dc271545bd62cc70`. Claude 검토 대상 HEAD: `2066a31a1006f6026d915ad0aa7606c9bf610a0d`.

## 완료한 구현

- 기존 19종 디자인에 실사 AI 예시 사진 26장 적용. 가상 인물임을 안내하고 실제 사진으로 교체 가능. 최대 사진 216KiB, 합계 약 2.3MiB WebP.
- Next 서버에 저장·초안·게시·카카오/구글 PKCE·비공개 사진·방명록·RSVP API, 입력·소유권·해시·CSRF·한도·중복 방지 구현.
- 새 운영 패키지 없이 기존 Next/Node와 Supabase HTTP API 사용. 기존 의존성 lockfile 유지.
- Sites는 정적 편집 미리보기로 구성. 2026-10-03 사용자 요청으로 전체 공개했으며, 내용은 그 브라우저에만 보관하고 하객 공유는 비활성화. 새로고침·뒤로가기 지원.

## 확인한 증거

- 모바일 375×812에서 19종 표지 사진 로딩·화면 넘침 검사 통과. 표지 캡처와 전체 비교 이미지를 `docs/evidence/`에 보관.
- 실제 브라우저에서 사진 선택·신랑 이름 변경·저장·내 청첩장 목록 확인. `editor-saved.jpg`.
- 로컬 Sites 산출물에서 편집·저장·새로고침 복원, 유효/무효 WebMCP 도구 검증 통과. `sites-preview-qa.json`.
- TypeScript, Next webpack production build, preview build 및 백엔드 HTTP fixture 28개 통합 검사 완료 기록. 마지막 검증 결과는 `verification.json` 참고.
- npm audit 알려진 취약점 0개. lint 기존 미리보기 shim의 미사용 변수 경고 2개, 오류 없음.

## 배포

- GitHub: `https://github.com/dudqks0319-cpu/wedding-invitation-2026-10-02` (공개). 2026-10-03 사용자 요청으로 변경. `isPrivate=false`·`visibility=PUBLIC` 읽기 확인 및 인증 없는 GitHub API HTTP 200 확인. 현재 증거는 `docs/evidence/github-public-access.json`, 이전 업로드 커밋은 `docs/evidence/deployment.json` 확인.
- Sites ID: `appgprj_6abf84676b4881918d32542f0e76190c`. 최초 소유자 전용 배포 성공 후 2026-10-03 공개로 변경. 배포 기록은 `docs/evidence/deployment.json`, 현재 공개 설정은 `docs/evidence/site-public-access.json` 확인.
- Sites: https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site — `succeeded`, 배포 소스 `2862fb3555a7a320af5b63459c3858f4a5aed73d`.
- Sites 배포는 미리보기 산출물이고 Next API 서버 배포 증거가 아닙니다.
- 공개 설정 `public`, revision 2를 Sites에서 읽어 확인. 인증 없는 HTTP 200, 앱 제목 확인 및 로그인 차단 화면 없음. `docs/evidence/public-access-http.json`.

## Claude 검토

- 로컬 Claude CLI는 OAuth 세션 만료로 검토 미실행. 재로그인/계정 설정 변경 없이 이미 로그인된 Claude 앱의 기존 청첩장 대화에 검토 요청 전달. 개인 대화 링크는 공개 문서에서 제외.
- 최신 main에서 추출한 83개 텍스트 파일과 19종 실제 모바일 렌더링 화면을 첨부. 파일 수정·push·배포·계정 변경·다른 에이전트 실행은 금지한 읽기 전용 검토 완료. 실사 사진과 디자인은 긍정 평가. 요청 한도(P1), 초안 충돌·예시 사진 게시·anon 읽기·누적 저장량·전역 SQL 잠금(P2)을 지적함.
- 주요 코드 근거를 Codex가 대조했으며 [검토 보고서](CLAUDE_REVIEW.md)에 우선순위와 재현 한계를 기록. 실제 부하·DB·공유 검증 및 수정은 미실행. CLI 실패·최종 응답·앱 캡처는 로컬 보관하며 공개 커밋에서 제외.
- Claude 환경은 공개 사이트를 프록시 403으로 열지 못하여 코드·첨부 화면을 검토. Codex가 확인한 Sites 공개 HTTP 200과 구분한다. 이번 후속 커밋은 공개 설정·검토 문서만 갱신하며 앱 재배포는 하지 않는다.

- 통합 release harness: ATTENTION (공통 release-ledger.yaml·RELEASE_STATUS.md 없음). 실제 백엔드 release-ready 주장 없음. 프로젝트 상태는 이 문서가 관리함.

## HOLD: 실제 백엔드 연결

Supabase 프로젝트 선택과 비용 확인 응답이 아직 없습니다. 다른 앱의 프로젝트는 읽기만 했으며 변경하지 않았습니다. 실제 마이그레이션·RLS 실행, 실제 공급자 로그인, 두 계정 격리, 실제 서버 저장·하객 공유·비용 관측은 확인되지 않았습니다. 로컬 Docker 실행 환경도 사용할 수 없어 SQL 테스트는 미실행입니다. [연결 절차](BACKEND_SETUP.md).

## 다음 작업과 재시작

다음 구현에서는 Claude가 지적한 요청 한도와 초안 충돌부터 수정·검증합니다. 소유자가 Supabase 프로젝트를 선택하고 비용을 확인하면 새 전용 프로젝트에 마이그레이션과 `tests/rls.sql`을 적용하고, 원격 Next 서버·공급자 설정을 연결합니다. 기존 Sites ID와 GitHub 저장소를 재사용합니다. 재시작 요청: “docs/current-state.md와 docs/CLAUDE_REVIEW.md를 읽고 봄결의 검토 지적사항과 실제 Supabase·OAuth·서버 저장 연결을 마무리해줘.”

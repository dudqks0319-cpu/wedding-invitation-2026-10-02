# 봄결 · 사진으로 만드는 초대장

모바일 청첩장 13종, 돌잔치 4종, 부모님 잔치 2종을 편집하는 Next.js 앱입니다. 표지와 갤러리에 가상 인물의 **실사 AI 예시 사진 26장**을 적용했습니다. 고객의 실제 사진으로 바꿔 사용할 수 있습니다.

## 실행

```sh
npm ci
npm run dev
```

기본값은 `local` 모드입니다. 내용과 사진은 현재 브라우저에 저장하며, 다른 기기의 하객에게 공유되지 않습니다. 예시 초대장은 읽기 전용입니다.

```sh
npm run build:preview  # dist-preview/index.html: 한 파일 미리보기
npm run build:sites    # dist/index.html: Sites 배포용 미리보기
npm run build         # Next 서버 및 API 빌드
npm run test:backend  # 실행 중인 Next API + 격리된 Supabase HTTP fixture
```

Sites 배포는 **전체 공개 디자인·편집 미리보기**입니다. 내용은 해당 브라우저에만 저장되며, Sites 산출물에는 Next API 서버가 포함되지 않습니다. 실제 DB·로그인·하객 공유는 별도 서버 연결 후 활성화해야 합니다. [백엔드 연결 안내](docs/BACKEND_SETUP.md)와 [Claude 코드·화면 검토](docs/CLAUDE_REVIEW.md)를 확인하세요.

## 구현 내용

- 실시간 이름·문구·사진·장소 편집, 갤러리, 달력, 길찾기, 계좌 복사.
- Supabase REST/Auth/Storage를 연결하는 Next Route Handlers: 청첩장 저장·삭제·공개/비공개, 카카오·구글 PKCE 로그인, 사진 업로드, 방명록, 참석 의사.
- 초안·사진 소유권, 참석 응답 소유자 조회, 방명록 비밀번호 해시, 입력·파일·요청 한도, 중복 요청 방지, 서버 중지 스위치.
- 실제 공개된 청첩장의 서버 공유 메타데이터와 카카오 JS 공유. 네이버 로그인·결제·주소 검색 연동은 준비 상태입니다.

| 주소 | 화면 |
| --- | --- |
| `/templates` | 19종 디자인 선택 |
| `/create/[id]` | 편집 및 실시간 미리보기 |
| `/i/sample-[id]` | 실사 AI 샘플 초대장 |
| `/my` | 내 초대장·참석 응답 |
| `/login` | 원격 모드 카카오·구글 로그인 |

Sites와 한 파일 미리보기의 경로는 `/#/templates`처럼 표시됩니다. 새로고침과 뒤로가기를 지원합니다.

## 검증 및 기록

[현재 상태](docs/current-state.md), [사진 생성 프롬프트](docs/evidence/photo-generation.json), [화면 검사](docs/evidence/browser-covers.json), [백엔드 테스트](docs/evidence/backend-integration.log), [보안 검사](docs/evidence/security-gate.md).

HTTP fixture 테스트는 실제 Supabase 마이그레이션·RLS·OAuth 계정 검증을 대신하지 않습니다. 배포 상태와 실제 서비스 검증은 현재 상태 문서에서 구분합니다.

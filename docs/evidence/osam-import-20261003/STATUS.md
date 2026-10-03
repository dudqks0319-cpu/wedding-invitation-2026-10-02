# 오삼오삼에서 가져온 웹 기능

2026-10-03. 구현과 로컬 검증 완료, 운영 배포·검사 대기.

| 참고 기능 | 새 서비스 적용 |
|---|---|
| 주소 선택/검색 | 공식 우편번호 SDK, 도로명/지번 선택, 오류/재시도/직접 입력. 주소 변경 시 이전 좌표 제거 |
| 사진 표현 | 대표 사진 위치·확대·가득 채우기/전체 보기, 적용/취소/초기화, 교체 시 구도 초기화 |
| 초대장 글꼴 | 기존 디자인 기본값, 고운바탕, 고운돋움, Pretendard |
| iCalendar | 한국 시간에서 UTC 변환, UTF-8 줄 접기/이스케이프, stable UID, 전화/계좌/하객 제외 |
| 디자인 탐색 | 이름/영문/태그 검색과 분류 조합, 브라우저에만 찜 저장 |

기존 `/Users/jyb-m3max/Desktop/codex/osam-rebuild`의 주소·사진 표현·글꼴·일정 로직을 새 구조에 맞게 사용했다. [원본 파일 지문](provenance.json). 기존 실제 초대장이나 사용자 데이터는 가져오지 않았다. 기존 오삼오삼 원본·계정·앱 API·등록된 OAuth 경로와 무료 시험 운영 한도를 유지한다. 신규 옵션은 선택 필드여서 이전 초안도 검증/표시된다. D1 JSON 구조에 저장하므로 이번 이식에는 DB migration이 없다.

## 검증

- 기능 단위 9개: [결과](unit.json), `node tests/osam-import.mjs`.
- 실제 로컬 workerd/D1/R2/이미지 디코더 Cloudflare 41개: [결과](cloudflare-local.json), [로그](../osam-import-cloudflare-test.log).
- 기존 Next 백엔드 28개(로컬 HTTP 저장 fixture): [로그](../osam-import-backend-test.log). 운영 Supabase 검증이 아니다.
- 인증 브리지 16개: [결과](auth-local.json). 세션 시나리오 6개와 iframe/실제 이탈 판정 4개: [로그](../osam-import-session-test.log).
- lint/TypeScript/Next/Cloudflare 빌드 성공: 같은 evidence 상위 폴더 `osam-import-*.log`. 격리 런타임 Wrangler [dry-run](wrangler-dry-run.log) 성공.
- 모바일 브라우저 320/390/430px에서 가로 넘침 없음, 검색/찜 재열기, 사진 위치 `.51/.49`·확대 `1.3`·Pretendard 저장 후 재열기 확인. 사진 맞춤 변경 취소 시 기존 값 유지.
- 공개 건물 ‘판교역로 166’ 검색/선택 성공. iframe 입력 시 앱이 가려지던 기존 세션 경계 오류를 수정했다. 새 주소의 지도 링크는 주소 검색으로 연결된다.
- ‘캘린더에 일정 저장’ 버튼에서 실제 다운로드한 [파일](downloaded-calendar.ics)의 DTSTART `20270417T033000Z`를 확인했다. 예시 행사 12:30 한국 시간과 일치한다. 브라우저 도구의 download 이벤트는 시간 초과였지만 실제 저장 파일을 검증했다.
- [주소 화면](address-mobile.jpg), [사진 구도](photo-adjust-mobile.jpg), [검색/찜](favorites-mobile.jpg), [일정](calendar-mobile.jpg). 모두 합성 예시를 사용한 로컬 모바일 브라우저 증거이며 실제 휴대전화 화면이 아니다.

## 보안과 남은 외부 검증

[이번 하나의 통합 보안 gate](SECURITY.md). 운영 의존성 audit 0, 개발 도구 braces 경고 6 high/0 critical은 별도 기록했다. release harness는 공통 앱 출시 문서 없음으로 ATTENTION이며 웹 배포와 App Store 준비를 혼동하지 않는다.

주소 자동 좌표 변환은 아직 제공하지 않는다. 정확한 좌표가 없으면 새 주소를 지도 앱에서 검색하고 Tmap 좌표 링크는 숨긴다. 실제 iPhone/카카오 인앱/Android 확인과 카카오 최종 공급자 인증은 후속 범위다. PlayMCP 이전 1회 전송을 반복하지 않았다.

다음: 검증한 격리 Worker를 기존 서비스에 배포 → 새 Sites 경유 실제 20개 운영 검사 → 테스트 자료 0/기존 집계 보존 → 공개 UI 재검증 → GitHub 반영 기록.

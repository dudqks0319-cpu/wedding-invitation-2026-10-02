# 보안·비용 방어 보완 — 2026-10-06

상태: **LOCAL_CHANGED_UNVERIFIED / NOT_DEPLOYED**

JSON 15초, 큰 업로드 60초의 전체 수신 기한과 연결 취소/reader 해제. 기존 바이트 상한과 인증/할당량은 유지했다.

변경 파일: `cloudflare/security.ts`.

사용자 설정에 따라 테스트·빌드·QA·추가 리뷰는 실행하지 않았다. **검증 미실행**. 현재 공개 서버/앱 설치본에 반영됐다는 의미가 아니다. 기존 미커밋 작업·데이터·제공사 설정·접근권한을 보존했다.

- [전체 기준](../../docs/agent-guidance/app-security-baseline.md)
- [전체 운영 현황과 남은 조건](../../reports/app-security-20261006/OPERATIONS.md)

다음: 전체 월 비용 상한과 대상 제공사/배포 버전을 고정하고, 승인된 범위에서 정상 요청·느린 전송·초과 바이트·취소·한도 소진을 확인한 뒤 실제 운영 반영/관측을 분리한다.

## 2026-10-07 후속

위 LOCAL_CHANGED_UNVERIFIED는 10월6일 시점이다. 이번 명시 점검 요청으로 JSON 수신 기한·취소·용량 경계를 로컬 재현하고 현재 Worker에 배포했다. 업로드60초 전체 전송/제공사 상한/WAF는 별도 미확인. 최신 근거는 [점검 원장](evidence/backend-audit-20261007/STATUS.md).

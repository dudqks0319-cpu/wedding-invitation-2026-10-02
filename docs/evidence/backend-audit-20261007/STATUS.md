# 청첩장 백엔드 점검 · 2026-10-07

**판정: 핵심 구현·수정 배포 완료 / 운영 최종 검증 일부 HOLD.**

## 완료 및 근거

- Claude Code Opus가 공개 소스 17파일 격리본을 점검·수정. 루트가 원본 해시와 diff 확인 후 photos/service 2파일 반영. 비밀·계정·환경 자료 전달 없음. 로컬 전용 상세 응답: `.omx/artifacts/claude-backend-20261007.md`.
- 수정: 15분 넘은 중단 업로드가 동시 슬롯을 점유하던 문제, `draft` 같은 주소 삭제 시 다른 소유자의 중복 기록까지 지우던 문제, 한 R2 삭제 실패가 후속 정리를 막던 문제, 만료 세션 로그아웃의 쿠키 잔존.
- 루트 추가 발견: 원본 workers.dev `/api/v2/health` 직접 요청이 200. 신규 웹 API·사진·화면에는 서명된 Sites 게이트웨이를 요구하도록 수정. 기존 v1/native 인증 계약은 유지하는 로컬 회귀 포함. 수정 뒤 실제 원본 요청 403.
- 로컬 통합 **90 PASS**: Cloudflare D1/R2·실제 sharp 디코더49, 웹 인증16, 앱 인증13, 게이트웨이12. 느린 JSON 전체15초·취소·초과 바이트·업로드4건·다른 소유자/예약어 정리 등을 재현. Cloudflare 빌드, 타입, 변경 백엔드 lint, Worker dry-run PASS. 업로드60초 기한은 소스 검토이며 실제60초 전송 시험은 하지 않음.
- 공개 운영 읽기 **8 PASS**, 기존 브라우저 `/my` 로그인됨/오류 없음. 이 세션의 Google/카카오 공급자 새 왕복 증거는 아님.
- Cloudflare `osamosam-api` version **371e1d5b-0eb5-47fc-a4d2-40c41c109438**, 배포 소스 **f6ee5f4**. GitHub push 확인. Sites 기존 공개 version3 유지. `No updated asset files to upload`: 미배포 RSVP/iOS 후보 제외, 기존 공개 화면/이미지와 legacy runtime·D1/R2 자료·키·스키마·요금제/한도 보존.
- 기존 실사 예시 대표 사진2종 HTTP200. 이번 백엔드 범위에 새 이미지 생성 필요 없음.

## 남은 조건

1. **운영 합성 쓰기 검증 승인 대기**: 자동 승인 심사가 임시 계정2개/사진1장 생성·공유·응답·삭제 및 변환1회의 사용량 발생 경로를 구체 승인되지 않은 것으로 판단해 거절. 명령은 실행되지 않음. 사용자에게 구체 범위 승인 질문 전달. 준비된 `tests/cloudflare.production.mjs`는 쓰기 전에 health 확인하고 이번 UUID/주소/요청 번호만 정리한다. 승인 전 재실행 금지.
2. 실제 카카오 인증 왕복, 새 Google 왕복·실기기 테스트는 별도 HOLD. 기존 iOS/TestFlight 원장은 보존.
3. 제공사 계정 합산 비용 상한·WAF/DDoS 강제 설정 미확인. 내부 쿼터와 원본403은 계정 청구 보장이 아님. 기존 npm audit high1(source-map-js)도 기록; 신규 Worker 모듈에는 해당 파서 없음. 상세 [보안 게이트](SECURITY_GATE.md).
4. R2 장애에서 legacy 계정 삭제의 최종 완료는 foreign-key 보호와 재시도에 의존; 이번 테스트는 전체 계정 삭제 완료를 증명하지 않음.

## 재개

원장과 `production-write-review.md`의 승인 상태 확인. 구체 승인이 오면 동일 Site/설정에서 `SITE_ORIGIN=https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site OSAM_STAGE=<보존된 격리 stage> WEDDING_EVIDENCE_DIR=docs/evidence/backend-audit-20261007 node tests/cloudflare.production.mjs` 실행하고 정확한 합성 자료 정리 및 기존 자료 수를 확인한다. stage 위치는 `release-stage.json`; 유실 시 원래 legacy release snapshot + 공개 프런트 SHA256 + 현재 backend 모듈로 재구성. 기존 dirty 작업을 한꺼번에 배포하지 않는다.

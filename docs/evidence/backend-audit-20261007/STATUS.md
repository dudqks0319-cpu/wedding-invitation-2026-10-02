# 청첩장 백엔드 점검 · 2026-10-07

진행 중. 공개 Site active/public/version 3. 익명 health 200(Cloudflare D1/R2), 세션/목록 401. 기존 브라우저 `/my` 로그인됨, 오류 로그 없음.

Claude Code Opus는 공개 소스 격리본에서 4개 결함을 검토하고 photos/service 2파일을 수정했다. 루트가 diff 및 원본 해시를 확인해 반영. 배포와 회귀 검증은 아직 미실행. 기존 dirty RSVP/iOS 변경과 이전 서비스 사용자 데이터 보존.

검증 대상: 소유권/중복방지/공개 스냅샷/사진 수신 제한/삭제·정리/로그아웃/인증 브리지, 실제 Cloudflare 합성 계정 흐름. 제공사 OAuth 실제 왕복·계정 하드캡·WAF는 별도 증거가 필요.

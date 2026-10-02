#!/usr/bin/env bash
# 코덱스(Codex CLI)에게 작업 맡기기
#   bash scripts/run-codex.sh photos    # 예시 사진 26장 만들기
#   bash scripts/run-codex.sh backend   # 백엔드 만들기
# 필요: OPENAI_API_KEY 환경 변수 (또는 미리 `codex login` 해두기)
set -euo pipefail
cd "$(dirname "$0")/.."

case "${1:-}" in
  photos) PROMPT_FILE=docs/codex/01-photos.md ;;
  backend) PROMPT_FILE=docs/codex/02-backend.md ;;
  *) echo "사용법: bash scripts/run-codex.sh [photos|backend]"; exit 1 ;;
esac

if ! command -v codex >/dev/null 2>&1; then
  echo "📦 Codex CLI 설치 중…"
  npm install -g @openai/codex
fi

if ! codex login status >/dev/null 2>&1; then
  if [ -n "${OPENAI_API_KEY:-}" ]; then
    printenv OPENAI_API_KEY | codex login --with-api-key
  else
    echo "❌ 로그인이 필요해요: OPENAI_API_KEY 를 설정하거나 'codex login' 을 먼저 실행하세요."
    exit 1
  fi
fi

mkdir -p .codex-logs
LOG=".codex-logs/$(date +%Y%m%d-%H%M%S)-$1.md"
echo "🤖 Codex 작업 시작: $PROMPT_FILE (결과 요약 → $LOG)"
codex exec \
  --sandbox workspace-write \
  -c sandbox_workspace_write.network_access=true \
  --enable image_generation \
  -o "$LOG" \
  - < "$PROMPT_FILE"
echo "✅ 끝! 요약: $LOG"

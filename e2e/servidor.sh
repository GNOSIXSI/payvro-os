#!/usr/bin/env bash
# Starts the local Convex stub deployment, builds Next against it, then serves the app.
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
cd "$raiz"

export CONVEX_AGENT_MODE=anonymous
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY-}"
registro="${TMPDIR:-/tmp}/payvro-convex-e2e.log"

setsid npx convex dev --typecheck disable --tail-logs disable >"$registro" 2>&1 &
convex_pid=$!

limpiar() {
  kill -TERM -- -"$convex_pid" 2>/dev/null || kill "$convex_pid" 2>/dev/null || true
  wait "$convex_pid" 2>/dev/null || true
}
trap limpiar EXIT INT TERM

url=""
for _ in $(seq 1 90); do
  if [[ -f .env.local ]]; then
    url="$(sed -n 's/^NEXT_PUBLIC_CONVEX_URL=//p' .env.local | tail -1 | tr -d "\"'")"
  fi
  if [[ -n "$url" ]] && node -e "fetch(process.argv[1] + '/instance_name').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" "$url"; then
    break
  fi
  if ! kill -0 "$convex_pid" 2>/dev/null; then
    echo "convex dev terminó antes de estar listo" >&2
    cat "$registro" >&2 || true
    exit 1
  fi
  url=""
  sleep 1
done

if [[ -z "$url" ]]; then
  echo "Convex no publicó NEXT_PUBLIC_CONVEX_URL" >&2
  cat "$registro" >&2 || true
  exit 1
fi

export NEXT_PUBLIC_CONVEX_URL="$url"
export PORT="${PORT:-3105}"
npm run build
npx next start --hostname 127.0.0.1 --port "$PORT"

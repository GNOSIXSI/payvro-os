#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Both builds and their checks inherit one synthetic canary. Tests can supply their own.
export PAYVRO_SENTINEL="${PAYVRO_SENTINEL:-payvro-ci-canary-not-a-credential}"

log="$(mktemp)"
trap 'rm -f -- "$log"' EXIT

paso() {
  local estado=0
  printf '\n==> %s\n' "$*"
  "$@" >"$log" 2>&1 || estado=$?
  node scripts/revisar-bundle.mjs --logs "$log"
  cat "$log"
  return "$estado"
}

paso npm run typecheck
paso npm run lint
paso npm test
paso npm run audit
paso npm run build
paso npm run bundle:revisar
paso npm run e2e
# E2E builds Next again with its isolated backend URL.
paso npm run bundle:revisar
# Next.js build output (.next/) and the local Convex backend state (.convex/, written by
# `convex codegen` with an ephemeral admin key) are gitignored, but gitleaks dir scans
# them and flags generated values. This env config replaces .gitleaks.toml for the dir scan.
GITLEAKS_CONFIG_TOML=$'[extend]\nuseDefault = true\n\n[[allowlists]]\npaths = ["^\\\\.next/", "^\\\\.convex/"]\n' paso npm run secrets

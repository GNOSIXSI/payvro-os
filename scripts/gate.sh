#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

npm run typecheck
npm run lint
npm test
npm run build
npm run e2e
# Next.js build output is ignored, but gitleaks dir scans it and flags generated values.
GITLEAKS_CONFIG_TOML=$'[extend]\nuseDefault = true\n\n[[allowlists]]\npaths = ["^\\\\.next/"]\n' npm run secrets

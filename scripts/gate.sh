#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

npm run typecheck
npm run lint
npm test
npm run build
npm run e2e
npm run secrets

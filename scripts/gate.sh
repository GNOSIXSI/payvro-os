#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

npm run typecheck
npm run lint
npm test
npm run build
npm run e2e
# Next.js build output (.next/) and the local Convex backend state (.convex/, written by
# `convex codegen` with an ephemeral admin key) are gitignored, but gitleaks dir scans
# them and flags generated values. This env config replaces .gitleaks.toml for the dir scan.
GITLEAKS_CONFIG_TOML=$'[extend]\nuseDefault = true\n\n[[allowlists]]\npaths = ["^\\\\.next/", "^\\\\.convex/"]\n' npm run secrets

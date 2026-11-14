---
id: WP-OS-01
title: Esqueleto, compuertas y contrato
lane: sol
reviewers: [sonnet]
depends_on: []
size: M
milestone: M1
---

# WP-OS-01 — Esqueleto, compuertas y contrato

## Goal

A runnable Next.js + Convex repo where `npm run gate` works end to end and the public Convex functions of `ARCHITECTURE.md` §8 exist as typed stubs, so the engine (WP-OS-02) and the screens (WP-OS-04) can be built in parallel without sharing a file.

## Files it may touch

- Root config: `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.mts`, `playwright.config.ts`, `components.json`, `.gitleaks.toml`, `.env.example` (rename only, see step 1)
- `.github/workflows/gate.yml`
- `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `app/providers.tsx`
- `components/ui/**` (shadcn primitives only: button, card, badge, input, label, table)
- `lib/modo.ts`, `lib/utils.ts`
- `packages/engine/package.json`, `packages/engine/src/index.ts`, `packages/engine/src/money.ts`, `packages/engine/src/ids.ts`
- `convex/schema.ts` (empty schema), `convex/auth.config.ts`, `convex/tsconfig.json`, `convex/_generated/**`
- `convex/negocio.ts`, `convex/cobros.ts`, `convex/panel.ts`, `convex/publico.ts`, `convex/demo.ts` — **stubs only**
- `convex/_stub/fixtures.ts`
- `tests/money.test.ts`, `tests/ids.test.ts`, `tests/limites.test.ts`
- `e2e/humo.spec.ts`
- `scripts/gate.sh`

## Files it must not touch

`CONTEXT.md`, `ARCHITECTURE.md`, `SECURITY.md`, `PLAN.md`, `AGENTS.md`, `docs/**` (except the rename in step 1), `public/brand/**`, `LICENSE`, `convex/motor/**`, `packages/engine/src/estados.ts`, `packages/engine/src/verificacion.ts`, `packages/engine/src/pey/**`, `app/pagar/**`, `app/panel/**`.

## Steps

1. `git mv docs/env.example .env.example` and delete the three "NOTE FOR THE ORCHESTRATOR" lines at its top. Change nothing else in it.
2. Create the Next.js app (App Router, TypeScript strict, Tailwind). Node 24 in `.nvmrc`. Pin exact versions (no `^`, no `~`). Use the current stable releases of `next`, `react`, `convex`, `@clerk/nextjs`, `tailwindcss`, `vitest`, `convex-test`, `@playwright/test`, `typescript`, `eslint`; check each library's current docs before writing config instead of relying on memory.
3. Brand tokens in `app/globals.css` as CSS variables and Tailwind theme entries: ink `#142B3B`, paper `#F5F3EC`, petróleo `#076B76`, teal `#00B8B2`, magenta `#EF006D`, yellow `#FFC400`, orange `#FF7900`, line `#D9D5C8`, muted `#4A5E6B`. Fonts Noto Sans Display and Noto Sans through `next/font/google`.
4. `app/providers.tsx`: Convex provider always. Clerk provider (`ConvexProviderWithClerk`) only when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set; without it, a plain `ConvexProvider`. The app must build and run with no Clerk variables at all.
5. `app/page.tsx`: logo from `public/brand/payvro-logo-claro.svg`, the line "Cobra y libera, sin comprobantes.", the mode tag (`DEMO` when `negocio.obtener().modo === "demo"`), a link to `/panel`. Nothing else.
6. `packages/engine`: `money.ts` (`aCentavos`, `aPesos`, `MONTO_MIN_CENTAVOS`, `MONTO_MAX_CENTAVOS`) and `ids.ts` (`nuevoId(prefijo)`, `esId(prefijo, valor)`) exactly as `ARCHITECTURE.md` §6.1 and `CONTEXT.md` §3 describe. Ids use `crypto.getRandomValues`, 26 Crockford base32 chars (130 bits) after the prefix.
7. Convex: `npx convex dev --once` to generate `_generated`. `convex/auth.config.ts` reads `CLERK_JWT_ISSUER_DOMAIN` and exports an empty provider list when it is unset.
8. Stubs. For every function in `ARCHITECTURE.md` §8, export it with its final name, final argument validators and final return type. Queries return data from `convex/_stub/fixtures.ts` (four cobros, one per visible state, business "Dulces Ana — Ejemplo", mode `demo`). Mutations throw `ConvexError({codigo: "NO_IMPLEMENTADO", mensaje: "…"})`. Put `// STUB WP-OS-01 — replaced by WP-OS-02` on the first line of each stub file.
9. ESLint: the import boundaries of `ARCHITECTURE.md` §3 as `no-restricted-imports` / `no-restricted-globals` overrides per directory (`packages/engine/**` cannot import `convex`, `next`, `@clerk/*`, cannot use `process` or global `fetch`; `app/**` and `components/**` cannot import `packages/engine/src/pey/*`).
10. `scripts/gate.sh` and npm scripts `typecheck`, `lint`, `test`, `build`, `e2e`, `secrets`, `gate`, `dev` as in `AGENTS.md` §2. `e2e` builds, starts the app in DEMO and runs Playwright against it. `secrets` runs gitleaks in redacted mode over the tree and the git history.
11. `.github/workflows/gate.yml`: on pull request and on push to `main`, `npm ci` then `npm run gate`. No secrets in the workflow; the E2E runs in DEMO.
12. Tests, each seen failing first:
    - `tests/money.test.ts`: `aCentavos(149)` → 14900; `aCentavos(0.01)` → 1; `aCentavos(0.1 + 0.2)` → 30; rejects `149.999`, `-1`, `NaN`, `Infinity`, `0`; `aPesos(1)` → 0.01; round trip for 1…100000 step 7.
    - `tests/ids.test.ts`: prefix, length, charset, 10,000 ids without collision, `esId` rejects another prefix.
    - `tests/limites.test.ts`: runs ESLint programmatically on two fixture strings (an engine file importing `convex/server`; an app file importing the pey client) and expects an error for each.
    - `e2e/humo.spec.ts`: home loads, shows "Cobra y libera, sin comprobantes." and the `DEMO` tag.

## Done criterion

Observable
- A fresh clone runs with only a Convex deployment: no Clerk variables, no pey variables.
- `http://localhost:3000` shows the brand, the tagline and the `DEMO` tag.
- Every function name of `ARCHITECTURE.md` §8 resolves in `convex/_generated/api`.
- A pull request triggers the `gate` workflow and it passes.

Commands that must pass, output pasted in the PR
```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run e2e
npm run secrets
npm run gate
git ls-files | grep -c '^\.env' # prints 1 (only .env.example)
```

In the PR: for each of the four test files, the command and the failing assertion you saw before the implementation existed.

## Out of scope

State machine, schema tables, simulator, any pey code, payer page, panel screens, Clerk sign-in screens, deploy, `doctor`, `smoke:demo`.

## Risks

- Version drift between what you remember and what is current: read the docs of Next.js, Convex and Clerk for the install steps; pin what you install.
- Turbopack and symlinked `node_modules`: use `npm ci` in the worktree; if `next build` fails on that, say so in the PR instead of switching bundlers silently.
- gitleaks may not be installed on the runner. If it is missing, the `secrets` script must fail loudly, not pass. Say in the PR how it was provided.
- The stubs are a contract. A name or type that differs from `ARCHITECTURE.md` §8 breaks two other packages; if §8 is wrong, propose the change in the PR body and keep the stub as specified.

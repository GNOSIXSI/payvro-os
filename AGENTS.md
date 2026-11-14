# AGENTS — rules for any agent working in this repo

This repo is PAYVRO OS: public, MIT, the Hackatón México submission. It handles verification of real payments. Read in this order before touching anything: `CONTEXT.md` (words and invariants), `ARCHITECTURE.md` (the spec), your work package in `docs/wp/`, then `SECURITY.md`.

If you are an agent **installing** PAYVRO for a business owner, you are in the wrong file: read `INSTALL.md`.

## 1. Stack

Next.js (App Router, TypeScript strict) · Tailwind + shadcn/ui · Clerk · Convex · pey API · Vitest + convex-test · Playwright · Node 24 · npm.
Locked (ADR-0001). Do not add a database, a queue, a service, a state library, an ORM or an AI SDK. A new runtime dependency needs a line in the PR saying why and what it replaces.

## 2. Commands

WP-OS-01 creates these scripts. From then on they are the only way to check work.

| Command | Does |
|---|---|
| `npm ci` | Install exactly the lockfile. Never `npm install` in CI or in a worktree with linked `node_modules`. |
| `npm run dev` | Next.js + `convex dev` together. |
| `npm run typecheck` | `tsc --noEmit` for app, engine and convex. |
| `npm run lint` | ESLint, including the import-boundary rules of `ARCHITECTURE.md` §3. |
| `npm test` | Vitest: engine unit tests and convex-test. |
| `npm run e2e` | Playwright, DEMO mode, against a production build. |
| `npm run build` | `next build`. |
| `npm run secrets` | gitleaks over the working tree and the branch history. |
| `npm run gate` | All of the above, in that order, stopping at the first failure. |
| `npm run doctor` | Checks the environment and prints names of missing variables, never values (WP-OS-05). |

## 3. Gates

A work package is done when **all** hold, and the PR shows the evidence:

1. `npm run gate` exits 0 on the PR head. Paste the tail of the output.
2. Every new behaviour has a test that you saw fail first. The PR says how it failed (command and the failing assertion).
3. The test points at the weak spot: the adversarial case sits where the guard is weakest, the guard is exercised through its caller, and a mutation of the guarded line makes a test fail.
4. The Done criterion of the WP file is met, with the exact commands it lists.
5. A reviewer from another vendor than the builder left a verdict (lanes in §7). A reviewer's APROBAR is not permission to merge.
6. Merge to `main` only with the founder's `VISTO-BUENO <sha>` on the PR.

CI runs the same `npm run gate`. A check that nothing consumes is not a gate: the PR is blocked by the required check, not by a green badge.

## 4. Never

Money and truth
- Never mark a cobro `pagado_verificado` or `liberado` from anything but `convex/motor/verificar.ts → aplicarEvidencia`.
- Never trust a webhook body, a return URL, a query string or a client argument as proof of payment.
- Never add a public function that accepts a state, an amount paid, `verified: true`, a destination account or a `negocioId`.
- Never call pey from a mutation, from the browser or from Next.js server code. Only Convex actions call pey, through `PeyPuerto`.
- Never retry a pey POST whose outcome is unknown.
- Never create a QR with amount 0. Never use floats for money. Never compare a cobro against a transaction's total instead of its base.
- Never compute, store or display a fee, commission or percentage on a payment. Never make a limit depend on the number or amount of payments.
- Never write code that changes the destination account, or exposes the pey key, the bank account id or a CLABE to the browser.
- Never update or delete a bitácora row.

Secrets and people
- Never print, log, echo, commit or paste a secret value. Names and paths yes, values never.
- Never put a real CLABE, a real person's name, a phone number or an email in code, a fixture, a test, a doc, a screenshot or a commit message. Fixtures use `000000000000000000` and "Dulces Ana — Ejemplo".
- Never call `api.pey.mx` from a test. Tests use the simulator or recorded shapes.
- Never run a LIVE charge without the founder's explicit OK for that charge. LIVE charges are $0.01 on the event's test accounts.

Repo hygiene (this repo is public)
- No session links, no tool or model trailers, no `Co-Authored-By`, no "generated with" lines in commits or PR bodies.
- No personal emails. Commits are authored with the configured identity; do not change it.
- No copy that suggests endorsement by pey, Banxico or CoDi. No invented metrics, customers or partnerships.
- Do not copy history or files wholesale from the old private bootstrap.

Process
- Do not touch files outside your WP's "Files it may touch". If you need to, stop and say so in the PR.
- Do not push to `main`, do not merge, do not deploy, do not spend, do not create cloud resources. Builders stop at a PR.
- Do not edit `docs/adr/` to change a decision. Write a new ADR that supersedes it.
- Do not weaken a test, a lint rule or a gate to get green. If a check is wrong, say why in the PR and let the reviewer decide.

## 5. Conventions

- Domain words in Spanish, exactly as in `CONTEXT.md`: `cobro`, `intento`, `pago`, `evento`, `bitacora`, `negocio`, `liberar`, state names in `snake_case`. Technical words in English. Comments and docs for agents in English. UI copy in Spanish (Mexico): direct, no hype, no emojis.
- Money variables end in `Centavos`. A variable holding pesos ends in `Pesos` and exists only in `packages/engine/src/pey/`.
- Public ids: `neg_`, `cob_`, `int_`, `evt_`, `bit_`, `pag_`. Convex `_id` never leaves the backend.
- Errors: `ConvexError({ codigo, mensaje })` with a code from `ARCHITECTURE.md` §8.
- Validate every public function's arguments with Convex validators; reject unknown fields.
- Short functions, cohesive files, no mutation of inputs. Explicit error handling; no empty `catch`.
- No debug logging left behind. No `console.log` of request or response bodies, ever.
- UI: states always carry their text; amber never means paid; DEMO always shows the `DEMO` tag; brand SVGs from `public/brand/` unmodified.

## 6. File ownership

| Path | Owner lane | Others |
|---|---|---|
| `packages/engine/**` | astra | read-only |
| `convex/motor/**`, `convex/schema.ts` | astra | read-only |
| `convex/http.ts`, `convex/crons.ts` | astra | read-only |
| `convex/cobros.ts`, `panel.ts`, `publico.ts`, `demo.ts`, `negocio.ts`, `puertos.ts` | astra (implementation); sol created the stubs | signatures change only with an `ARCHITECTURE.md` §8 change in the same PR |
| `app/**`, `components/**`, `lib/**`, `e2e/**` | cursor-grok today; sol afterwards | astra: no |
| `scripts/**`, `.github/**`, root config files | sol | ask in the PR |
| `INSTALL.md`, `README.md`, `llms.txt` | sol | |
| `CONTEXT.md`, `ARCHITECTURE.md`, `SECURITY.md`, `PLAN.md`, `docs/adr/**` | orchestrator | builders propose changes in the PR body |
| `docs/wp/**` | orchestrator | builders tick nothing here; evidence goes in the PR |
| `docs/bitacora/**` | orchestrator writes, founder reviews | |
| `public/brand/**` | nobody edits | |

Two work packages running at once never share a writable path. If yours would, stop.

## 7. Lanes and reviewers

| Lane | Builds | Reviewed by |
|---|---|---|
| `astra` (GPT-6 Astra) | Engine, state machine, pey client, verification, sweep, webhook | `opus` + `gemini` |
| `sol` (GPT 6.1 Sol) | Skeleton, gates, install flow, deploy, later UI and templates | `sonnet` + `gemini` |
| `cursor-grok` (Grok 4.6) | Screens (last budget day: 2026-11-14) | `sonnet` + `gemini` |

The reviewer is never the builder's vendor. Give the reviewer the repo, not only the diff. Verify a reviewer's finding before repeating it.

## 8. Workflow

1. One WP → one branch `wp/WP-OS-NN-slug` → one PR. Branch from `main`, or from the predecessor's branch when the orchestrator says the WP is stacked.
2. Commits: `<type>: <description>` (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`). No trailers.
3. PR body: what and why, how to test, evidence for §3, risks, anything you could not do. Say plainly if a step was skipped or a test fails.
4. Shared Convex dev deployments: the last `convex dev` wins. Each worktree uses its own dev deployment; never point two branches at one.
5. When the WP teaches something about pey (a real response shape, a limit, an error), add it to `CONTEXT.md` §6 with its tag in the same PR.

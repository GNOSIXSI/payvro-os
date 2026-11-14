---
id: WP-OS-13
title: "Acceso para agentes: tokens con alcance mínimo y API de cobros"
lane: astra
reviewers: [opus, gemini]
depends_on: [WP-OS-08, WP-OS-10]
size: L
milestone: M2
---

# WP-OS-13 — Acceso para agentes con alcance mínimo

## Goal

An agent (the PAYVRO MCP, or the owner's own assistant) can create cobros and read their state through an HTTP API with a scoped, revocable token — and can do nothing else.

## Files it may touch

- `convex/motor/tokens.ts`, `convex/motor/tablas.ts` (table `tokensAgente`), `convex/agente.ts`, `convex/http.ts` (routes under `/api/v1/`)
- `convex/puertos.ts` (resolve a token to `{negocioId, actor: {tipo: "agente"}}`)
- `app/panel/ajustes/agentes/**`, `components/**`
- `tests/motor/tokens.test.ts`, `tests/agente/**`, `e2e/agentes.spec.ts`
- `docs/api.md`, `ARCHITECTURE.md` §8, `SECURITY.md` §7

## Files it must not touch

`packages/engine/src/verificacion.ts`, `convex/motor/verificar.ts`, `convex/motor/revision.ts` (agents are refused there already; add a test, not code).

## Steps

1. Token: 256 random bits, shown once at creation, stored as SHA-256 hash only; fields `{nombre, alcances[], creadoPor, expiraEn (≤ 90 days), revocadoEn?, ultimoUsoEn}`. Scopes: `cobros:crear`, `cobros:leer`. There is no scope for anything else, and adding one needs an ADR.
2. Routes (Convex HTTP actions, JSON, strict schemas, 16 KiB cap, `Cache-Control: no-store`):
   - `POST /api/v1/cobros` — header `Idempotency-Key` (required) → `{publicId, folio, estado, urlPagador?}`.
   - `GET /api/v1/cobros/{publicId}` → redacted state, amount, timestamps.
   - `GET /api/v1/cobros?estado=&cursor=` → page.
   No route for: cancel, retry, resolve, pause, profile, tokens, bitácora export, anything about the destination or the mode.
3. Authorization on every call: hash lookup, not revoked, not expired, scope present, negocio not paused for creates. The actor recorded in the bitácora is `{tipo: "agente", id: tokenPublicId}`.
4. Per-token limits: creates per minute and per day, and a maximum amount per cobro set by the owner at token creation (default: the negocio's usual ceiling). Exceeding → 429 / 422.
5. Panel: create token (name, scopes, expiry, max amount), copy once, list with last use, revoke. Created and revoked only by an owner session.
6. `docs/api.md`: the three routes, errors, idempotency rules, and the list of what an agent cannot do and why.
7. Tests, each seen failing first: plaintext token is nowhere in the database; revoked and expired tokens → 401; a `cobros:leer` token cannot create; a token of one negocio cannot read another's cobro (two-negocio fake); hostile fields (`estado`, `destino`, `negocioId`, `verificado`) → 400; replay with the same `Idempotency-Key` → same cobro and header `Idempotency-Replayed: true`; same key, other body → 409; an agent-created cobro verifies and releases exactly like an owner-created one; every non-listed operation called with a valid token → 404; prompt-like text in `concepto` is stored and rendered as text.

## Done criterion

Observable: with a token from the panel, `curl` creates a cobro in DEMO, reads it, and gets 404/401 on everything else; revoking the token in the panel makes the next call fail.

Commands that must pass
```bash
npm run gate
npx vitest run tests/motor/tokens.test.ts tests/agente
npx playwright test e2e/agentes.spec.ts
```

## Out of scope

The MCP server itself (separate repo; it consumes this API), OAuth, webhooks out to the agent, a hosted chat agent (Cloud).

## Risks

- Scope creep is the security risk here. "Let the agent also cancel" is a new ADR, not a quick addition.
- Timing side channels on token lookup: look up by hash, compare in constant time.

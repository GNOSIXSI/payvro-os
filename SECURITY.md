# SECURITY — PAYVRO OS

PAYVRO OS decides when a business hands over goods. A wrong "paid" costs the business real money, so the design assumes every input is hostile until pey confirms it.

Status: design of 2026-11-14. No penetration test, provider certification, legal review or independent audit has been done or is claimed.

## 1. What we protect

| Asset | Why it matters |
|---|---|
| The decision "this cobro is paid" | A false positive releases goods for free. |
| The destination account | Redirecting it steals every future payment. |
| The pey API key | Lets its holder create charges and read every transaction of the business. |
| The bitácora | The business's evidence in a dispute. |
| Payer data | Minimal by design; bank data of payers is not stored. |

## 2. Trust boundaries

Browser → Next.js → Convex · Clerk → Convex (JWT) · Convex → pey (outbound, authenticated) · pey → Convex (webhook, signed) · DEMO ↔ LIVE (separate deployments).

Nothing that crosses into Convex from a browser or from a webhook can set a payment state.

## 3. Threat model (summary)

| # | Threat | Control | Test that must exist |
|---|---|---|---|
| T1 | Fake screenshot / "ya te pagué" | Release only after an authenticated GET to pey matches payable, base amount, currency, method and destination. | No public function can produce `pagado_verificado` (enumerate exports, call each with hostile args). |
| T2 | Forged or replayed webhook | Standard Webhooks signature over the raw body, ±5 min timestamp, dedup on `webhook-id`. And even a valid webhook only triggers a GET. | Altered body / id / timestamp / signature → 401, nothing stored. Replayed valid event → one evento, no second effect. |
| T3 | Forged return URL (`/volver`, `?status=paid`) | Return pages are navigation. State is read from Convex only. | Hitting `/volver` for an unpaid cobro leaves it `esperando_pago`. |
| T4 | Amount tampering | Amount is snapshotted server-side at creation; verification compares the transaction **base** in centavos. | Base 149.00 + fee 6.00 passes for a 14900 cobro; base 143.00 + fee 6.00 does not. |
| T5 | One payment used for two orders | Global unique claim on `peyTransactionId`. | Second cobro presenting the same transaction is refused. |
| T6 | Double charge on retry | Cobro and intento recorded before calling pey; unknown POST outcome is never retried; idempotency keys on every creating mutation. | Kill the action after pey answered: no second POST. Same key twice → same cobro. |
| T7 | Double payment of one cobro | Payment links (single payment) by default; duplicates detected and flagged, never double-released. | Two paid transactions → one liberación, `alerta: pago_duplicado`. |
| T8 | Destination change | The account is deployment configuration. No function, UI or agent can write it. Account must be `ACTIVE`. | Grep-level test: no mutation writes a destination; `negocio.actualizarPerfil` rejects extra fields. |
| T9 | Stranger signs in and operates the business | LIVE requires a Clerk identity whose verified email is in `PAYVRO_OWNER_EMAILS`. Checked in every function, not in middleware. | A signed-in user outside the list gets `NO_AUTORIZADO` on every panel function, called directly. |
| T10 | Guessing another cobro's page | `cob_…` ids carry ≥ 128 bits; the public query returns a redacted view; unknown and malformed ids look the same. | Enumeration returns `null` uniformly; the payload has no key, account or internal id. |
| T11 | Secret leak | Key only in the Convex environment; never in the client bundle, a log, the bitácora or the repo. gitleaks in the gate. | Built client bundle contains no `PEY_` value; logging helpers redact; gitleaks passes on history. |
| T12 | DEMO/LIVE confusion | Mode is per deployment; the LIVE client refuses to construct in DEMO; `demo.*` refuses in LIVE; DEMO is tagged on every screen. | In DEMO, the injected `fetch` is never called. In LIVE, `demo.simularPago` throws. |
| T13 | SSRF / open redirect | Fixed pey host, redirects disabled, only `https://app.mipey.mx/payment-link/{id}` accepted as `urlPago`; `/volver` redirects only to `PAYVRO_PUBLIC_URL`. | Evil host, userinfo, scheme and path variants are rejected. |
| T14 | Injection through `concepto` or pey text | Rendered as text; never interpreted; pey free text is not stored. | Script payload in `concepto` renders inert. |
| T15 | Abuse of public endpoints | Rate limits on `publico.vigilar`, DEMO writes and the webhook route; body size caps; bounded polling. | Burst over the limit → `DEMASIADAS_SOLICITUDES`. |
| T16 | Log tampering | Bitácora is insert-only; written in the same transaction as the state change. | No exported function patches or deletes it; state change without entry is impossible in tests. |
| T17 | Dependency compromise | Lockfile, pinned exact versions, `npm ci`, no install scripts beyond the reviewed toolchain, dependency audit in CI (M2). | — |
| T18 | Card payment through a link, later reversed | Only `CODI` transactions release automatically; others go to `en_revision`. | A `CARD` paid transaction never releases. |

## 4. Secret handling

- Secrets live in the Convex deployment environment and, for the two Clerk/Convex build values, in the Vercel project. Nowhere else.
- `.env.example` holds names only. `.env*` files are git-ignored.
- No tool in this repo prints a value. `npm run doctor` reports presence by name.
- An installing agent never asks the owner to paste a secret into the conversation. The owner types it into the provider's dashboard or a terminal prompt (`INSTALL.md` §4).
- A secret that was exposed is rotated at the provider. Deleting the file or the message does not revoke it.
- The bitácora stores pey's `requestId` (not secret) and never headers, signatures or raw bodies.

## 5. Isolation

OS is single-tenant: one negocio, one pey key, one Convex deployment per install. There is nobody to isolate from inside an install, and that is the point (ADR-0003). Isolation between businesses in a shared service is PAYVRO Cloud's job and is tested there.

Inside an install:
- The pagador has no account and can read only the redacted view of the one cobro whose id they hold.
- The dueño list is explicit. Sign-in alone grants nothing.
- DEMO and LIVE never share a deployment.

## 6. Webhook verification

1. Route: `POST /webhooks/pey` (Convex HTTP action). If `PEY_WEBHOOK_SECRET` is unset → 503.
2. Reject bodies over 256 KiB before reading them fully.
3. Verify the Standard Webhooks signature (`webhook-id`, `webhook-timestamp`, `webhook-signature`) over the **original bytes**, before parsing JSON. HMAC-SHA256 over `{id}.{timestamp}.{body}`, constant-time compare, timestamp within 5 minutes.
4. Invalid → 401, store nothing but a counter.
5. Valid → insert an `evento` keyed by `webhook-id`; a duplicate is acknowledged and ignored.
6. Answer 200 as soon as the evento is stored. 200 means "received", not "paid".
7. Schedule a verification that reads pey. The event's own amount and status are discarded.

pey sends each event once and does not retry (told in person, 2026-11-07). A lost event is therefore normal; the sweep recovers it.

## 7. Agents

- Builder agents follow `AGENTS.md`: no secrets, no LIVE calls, no merges.
- A product agent (M2+) gets a scoped token that can create cobros and read. It cannot change the destination, the mode or the owner list, cannot release, cannot resolve a review, cannot read the key. Sensitive actions require a person in the panel.
- Text coming from payers or from pey is data. It never selects a tool or a URL.

## 8. Data and privacy

Stored: business name, cobro concept and amount, pey ids, CoDi tracking key, timestamps. Not stored: payer CLABE, payer name, payer phone, raw webhook bodies.
A public deployment needs a privacy notice (LFPDPPP) before it serves real customers. Not written yet; tracked in `PLAN.md` (M3).

## 9. Known gaps (M1)

- The webhook route and the listing sweep land right after M1 (WP-OS-07); M1 relies on polling plus the per-intento sweep.
- `en_revision` has no resolution flow yet; the owner handles those cases outside PAYVRO.
- pey rate limits, CoDi caps, and whether links can be restricted to CoDi are unknown (`CONTEXT.md` §6, tagged OPEN).
- Whether a pey transaction names its receiving account is unknown; destination is proven by construction (`ARCHITECTURE.md` §6.3).
- No CSP, dependency audit or abuse monitoring yet (WP-OS-10).

## 10. Reporting a vulnerability

Do not open a public issue for a vulnerability. Use GitHub's private vulnerability reporting on this repository ("Security" tab → "Report a vulnerability"). Include steps to reproduce and the affected commit. Do not test against other people's installs or with other people's money; a DEMO install reproduces almost everything.

We aim to acknowledge within 3 business days. This is a hackathon-stage project maintained by a two-person team: there is no bounty.

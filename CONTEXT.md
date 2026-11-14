# CONTEXT — domain language and invariants

Read this before writing code, a test or a doc. If a word here and a word in the code disagree, the code is wrong.
Domain words stay in Spanish everywhere (identifiers, tables, states, UI). Prose for agents is English.

Each statement about pey is tagged: **[FACT]** (in the OpenAPI snapshot of 2026-11-14, `info.version` 2026-10-20), **[NOTE]** (per pey, 2026-11-07, or earlier notes; not in the snapshot) or **[OPEN]** (unknown; do not build on a guess).

## 1. Product in one paragraph

PAYVRO: "Cobra y libera, sin comprobantes." A business creates a charge, the payer pays with CoDi, PAYVRO asks pey whether the money arrived at the right account for the right amount, and only then releases the order. One engine: **intención → cobro CoDi → pago verificado → liberación**. Templates per business type sit on top of that engine. The first template is "Pedido que se libera".

PAYVRO OS (this repo) serves exactly one business per installation.

## 2. Glossary

| Term | Meaning | Not to be confused with |
|---|---|---|
| **negocio** | The business that charges. Owns the pey API key and the bank account. One per OS install. | A Clerk user (a person). A negocio has people. |
| **dueño** | A person allowed to operate the negocio in the panel. | **operador** (Cloud role, fewer rights). |
| **pagador** | The person who pays. Has no account, never signs in. | cliente as a CRM record (not modeled in M1). |
| **intención** | What the payer wants: an order, an appointment, a quote. Step 1 of the engine. | **intento** (see below). Different words, different things. |
| **cobro** | One amount the negocio wants to collect for one intención. Has a folio, a concept, an amount in centavos and a state. The unit the dueño sees. | The pey payment link or QR (those belong to an intento). |
| **intento** | One attempt to collect a cobro through one pey payable (one link or one QR). A cobro has at most one active intento. Its public id is our idempotency key toward pey. | **intención**. |
| **payable** | pey's object that can be paid: payment link, CoDi QR or CoDi push. pey's word (`payableType`, `payableId`). | A transaction. |
| **transacción** | pey's record of money movement (`/transaction/{id}`). Evidence, read with an authenticated GET. | **pago**. |
| **pago** | Our record that a pey transaction was read, evaluated and bound to one cobro. One transacción ↔ at most one pago, globally. | A webhook saying "paid". |
| **evento** | A signal that something may have changed: a webhook, a poll result, a sweep hit, a simulator action. An evento never changes money state by itself; it only triggers a verification. | **bitácora** entry. |
| **verificación** | Reading pey with an authenticated GET and comparing against what the cobro expects. The only path to `pagado_verificado`. | Signature verification of a webhook (that only proves who rang the doorbell). |
| **liberación** | The business effect of a verified pago: the order becomes ready to deliver. Happens once per cobro. | Moving money. PAYVRO never moves money. |
| **bitácora** | Append-only log of every state change and every relevant pey call, visible to the dueño. | Debug logs. |
| **en revisión** | A cobro where pey shows money but something does not match. A person decides. Never released automatically. | An error screen. |
| **plantilla** | A business-type preset over the engine (pedido, cita, cotización, mostrador, membresía, checkout). | A UI theme. |
| **folio** | Short human number of a cobro inside a negocio (`#128`). Not a secret, not an id for URLs. | `publicId`. |
| **DEMO / LIVE** | Deployment mode. DEMO uses the simulator and never calls pey. LIVE calls pey. | A per-charge flag. Mode is per deployment. |
| **timbre** | The webhook: a doorbell. It tells us to go look. | Proof of payment. |
| **barrido** | Periodic sweep that re-reads pey to recover lost eventos. | Polling while a charge is on screen (**sondeo**). |
| **sondeo** | Short-interval polling (1–2 s) of one intento while someone is looking at it. | barrido. |

## 3. Identifiers

Every record has a public id with a type prefix, generated server-side from a CSPRNG, never derived from user input. Convex `_id` values stay internal and never appear in a URL or a log line meant for people.

| Prefix | Record | Notes |
|---|---|---|
| `neg_` | negocio | |
| `cob_` | cobro | Used in the payer URL `/pagar/{cob_…}`. At least 128 bits of entropy. A capability, not a secret credential. |
| `int_` | intento | Sent to pey as `clientReferenceId` (links) and in `metadata.payvro_intento`. Our idempotency key toward pey. |
| `evt_` | evento | Internal id. The Standard Webhooks `webhook-id` header is stored next to it as `webhookId`. |
| `bit_` | bitácora entry | Plus a per-negocio monotonic `seq`. |
| `pag_` | pago | Carries `peyTransactionId`. |

pey ids are stored verbatim and never reshaped: payment link id and transaction id are ULIDs **[FACT]**; a CoDi QR id is a Banxico IDC, not a ULID **[FACT]** — do not validate it as one.

`claveIdempotencia`: 16–128 chars `[A-Za-z0-9_-]`, created by the caller once per user intent (one per button press, reused on retry). Scope: `(negocio, operación, clave)`.

## 4. Invariants (never break; each has a test)

Money
1. PAYVRO never holds, moves or routes funds. Money goes from the pagador to the negocio's own account. No pooled accounts.
2. PAYVRO never charges a commission or a per-payment fee. No price, limit or plan depends on the number or amount of payments. No code path computes a fee on a payment.
3. Amounts are integer centavos (`montoCentavos`) everywhere inside. Pesos with decimals exist only inside the pey adapter. No floats in comparisons, no epsilon equality.
4. Never create a QR with amount 0. `montoCentavos >= 1` always.
5. The destination account is deployment configuration. No UI, API, agent or mutation can change it.

Truth
6. A cobro reaches `pagado_verificado` only inside the server, after an authenticated GET to pey returned evidence that matches payable, amount, currency, method and destination.
7. A webhook body is never evidence. Neither is a return URL, a query string, a screenshot or anything the browser sends.
8. Mismatch (amount, destination, duplicate, partial, tip, unexpected method, late payment) → `en_revision`. Never `liberado`.
9. One pey transaction binds to at most one cobro, ever (unique `peyTransactionId`).
10. Liberación happens at most once per cobro.

Order of operations
11. The cobro and its intento are written in Convex **before** pey is called. pey has no idempotency **[FACT: no idempotency header in the spec]**, so the intento is ours.
12. A POST to pey whose outcome is unknown (timeout, dropped connection) is never retried. The intento becomes `incierto`.
13. State transitions happen only in server mutations, through the transition table in `packages/engine`. No public function accepts a state as input.

Log
14. Every state change and every pey POST writes a bitácora entry in the same mutation that changes the state. Entries are never updated or deleted.
15. No secret, API key, signature, full webhook body or payer bank data is ever written to the bitácora, a log or the browser.

Mode
16. In DEMO, no code path can reach `api.pey.mx`. In LIVE, the simulator cannot settle anything.
17. Test CLABEs, account holders' names and any person's real data never enter the repo, a doc, a fixture or a screenshot. Fixtures use `000000000000000000` and obviously fictional business names ("Dulces Ana — Ejemplo").

## 5. States

Cobro: `borrador` → `esperando_pago` → `pagado_verificado` → `liberado`. Side exits: `expirado`, `cancelado`, `en_revision`.
Intento: `reservado` → `creado` → `pagado`. Side exits: `incierto`, `fallido`, `descartado`.

The full transition table, guards and diagrams are in `ARCHITECTURE.md` §5. That table is the specification; the code mirrors it.

What people read (Spanish, exact strings):

| Cobro state | Dueño sees | Pagador sees | Chip |
|---|---|---|---|
| `borrador` | Borrador | — | neutral |
| `esperando_pago` | Esperando pago | Esperando pago | amber `#FFF2C2` / text `#5A4300` |
| `pagado_verificado` | Pago verificado | Pago verificado | teal `#D6F2F0` / text `#04575F` |
| `liberado` | Liberado | Pago verificado | petróleo `#076B76` / white |
| `en_revision` | En revisión | Estamos revisando tu pago | orange `#FFE4CC` / text `#7A3500` |
| `expirado` | Expirado | Este cobro ya no está disponible | neutral |
| `cancelado` | Cancelado | Este cobro ya no está disponible | neutral |

Rules: a state always carries its text (never color alone). Amber never means paid. DEMO always shows the tag `DEMO`.

## 6. pey truths

API surface
- **[FACT]** Base URL `https://api.pey.mx`. Auth: `Authorization: Bearer <API key>`. There is no sandbox; pey's docs recommend testing in production with small amounts such as $0.01 MXN.
- **[FACT]** Amounts are MXN numbers with decimals, not centavos.
- **[FACT]** Error shape: `{"error":{"message","type","requestId"}}`. Keep `requestId` in the bitácora; it is not a secret.
- **[FACT]** Eleven operations: create QR, create push, register bank account, get bank account, create / update / get payment link, get transaction, list transactions by API key, by bank account, by QR.
- **[FACT]** There is no cancel for a link or a QR, no expiry event, no refunds, no payouts, no balances. PAYVRO collects; it does not pay out.

Payment link (fallback for orders)
- **[FACT]** `POST /payment-link/create` requires `amount > 0`, `successUrl`, `backUrl`; both URLs must be HTTPS. Optional `hasTip` (default false), `clientReferenceId` (≤ 255), `metadata`.
- **[FACT]** It has **no** `bankAccountId`, no expiration and no way to restrict payment methods. The money goes to the account linked to the API key.
- **[FACT]** Returns `{id, url}`; the example URL is `https://app.mipey.mx/payment-link/{id}`.
- **[FACT]** `GET /payment-link/{id}` returns `status` ∈ `pending | processing | paid | partial`, the original `amount`, `clientReferenceId`, `metadata` and `transactions[]` (each with `transactionId`, `paymentMethod`, `datePaid`, `amount`, `amountBreakdown{base,tip,fee}`). Only links created with the same API key are visible.
- **[FACT]** The example lists `paymentMethods: ["CODI","CARD"]`. A link can therefore be paid by card. Policy: only `CODI` releases automatically; anything else → `en_revision` (`metodo_no_permitido`).
- **[FACT]** `POST /payment-link/update` changes only the amount, only while `pending`. PAYVRO does not use it: a different amount is a different cobro.
- **[NOTE]** A link takes one payment; it is the option that avoids double charges.
- **[OPEN]** Whether a link can be limited to CoDi. Whether `partial` can happen with CoDi.

CoDi QR (default for orders and counter tags)
- **[FACT]** `POST /codi/qr`: `amount >= 0` (0 lets the payer type the amount — forbidden in PAYVRO), `concept`, `expiration` seconds (0 = none; minimum 360 when set), `numRef` (1–7 digits), `generateImage`, `bankAccountId` (must be `ACTIVE`; omitted = account linked to the key), `metadata`. Returns 201 `{id (IDC), qrString, qrImage?}`. For orders, PAYVRO uses one fixed amount and a 24-hour expiration.
- **[NOTE]** One QR accepts several payments. Orders use a QR by default under ADR-0006; an additional payment for the same order is held for review. The payment link is the fallback.
- **[FACT]** `GET /transaction/codi/qr/{id}` lists its transactions, 20 per page.

CoDi push
- **[FACT]** `POST /codi/pn`: `amount` in (0, 1,000,000], `phoneNumber` 10 digits, `expiration >= 360`. Returns `{transactionId, codiId}`. Not used in M1.

Transactions
- **[FACT]** `GET /transaction/{id}`: `status` ∈ `PENDING | PAID`, `amount`, `amountBreakdown{base,tip,fee}`, `currency`, `paymentMethod` ∈ `CARD | CODI`, `payableType` ∈ `PAYMENT_LINK | API_CODI_QR | API_CODI_PN`, `payableId`, `dateCreated`, `datePaid`, `metadata`. A transaction of another API key answers 404.
- **[FACT]** `amount` is the total; `base + tip + fee = amount`. Compare the cobro against **base**, never against the total.
- **[FACT]** `GET /transaction/api-key` lists 80 per page, newest first, with `nextToken`. `GET /transaction/bank-account/{id}` lists paid transactions of one registered account, 80 per page, newest first.
- **[FACT]** `metadata` values come back as strings. Transaction `metadata` may carry payer bank fields (`clabe`, `bankCode`, `accountType`, `trackingKey`). PAYVRO keeps `trackingKey` only and drops the rest.
- **[OPEN]** Whether the transaction body names the receiving account. Until known, destination is proven by construction (see `ARCHITECTURE.md` §6.3).

Bank accounts
- **[FACT]** `POST /bank-account` registers a CLABE under the API key; status goes `PENDING → PROCESSING → ACTIVE` (or `ERROR`) and takes up to 5 business days. Only `ACTIVE` accounts receive payments.
- **[FACT]** `GET /bank-account/{id}` returns the full `clabe` and holder `name`. PAYVRO reads `codiStatus` from it and stores neither.
- M1 runs on the hackathon's pre-authorized test accounts with $0.01 charges.

Webhooks
- **[FACT]** The OpenAPI snapshot has an empty `webhooks` section. Nothing below is in the spec.
- **[NOTE]** Signature follows Standard Webhooks (`webhook-id`, `webhook-timestamp`, `webhook-signature`). pey sends each event once and does not retry.
- **[NOTE]** Event names seen in earlier notes: `codi.qr.payment_received`, `payment_link.status_updated`, and a bank-account-updated event. Confirm names and payload against docs.pey.mx when building the webhook (WP-OS-07).
- **[OPEN]** How a webhook endpoint is registered (dashboard or API) and whether one API key can have several.

Limits
- **[OPEN]** Rate limits. The sondeo interval (1–2 s) is a founders' decision; back off on any 429 or 5xx.
- **[OPEN]** CoDi cap per charge (sources disagree: 1,500 or 6,000 UDIS).

Rules that are not pey's API
- Charging a commission on CoDi is prohibited (founders' reading of the rules; no legal opinion yet). PAYVRO's rule is stricter anyway: invariant 2.
- PAYVRO is not affiliated with, endorsed by or certified by pey, Banxico or CoDi. Never write copy that suggests it.

## 7. Out of the domain (M1)

Refunds, payouts, balances, card processing, invoicing (CFDI), inventory, customer accounts for payers, WhatsApp, multi-branch, multi-tenant. Multi-tenant lives in PAYVRO Cloud.

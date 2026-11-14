# ADR-0010 — Record before calling pey; the intento is the idempotency key; money is integer centavos

- Status: Accepted (locked by the founders, 2026-11-14)

## Context

Facts
- pey's create operations have no idempotency key. Two POSTs create two payables.
- A payable cannot be cancelled.
- pey amounts are MXN numbers with decimals. `POST /payment-link/update` documents round-half-up to 2 decimals.
- A transaction's `amount` is the total; `amountBreakdown` splits it into `base`, `tip`, `fee`.
- A network call can fail after the server acted and before the client heard: the outcome is then unknown.
- Convex mutations are transactions and cannot make network calls; actions can call the network and are not transactions.

## Decision

Order of operations
1. A mutation writes the cobro and an intento in state `reservado`, with the caller's `claveIdempotencia`, **before** anything is sent to pey. It refuses a second live intento for the same cobro.
2. An action then calls pey once, sending the intento's public id (`int_…`) as `clientReferenceId` and in `metadata`.
3. A second mutation records the outcome:
   - 2xx → `creado`, store the pey id.
   - 4xx → `fallido`. Nothing was created; the cobro may try again.
   - timeout, connection error, 5xx → `incierto`. **The POST is never repeated for this intento.**
4. An `incierto` intento is abandoned (`descartado`) after 60 s. This is safe: PAYVRO never received its URL or QR string, so no payer can pay it. The sweep still treats a paid transaction naming a discarded intento as `en_revision`.

Idempotency on our side
5. Every creating mutation takes a `claveIdempotencia` (16–128 chars, `[A-Za-z0-9_-]`), unique per `(negocio, operación)`. Same key and same input → the original result. Same key and different input → `CLAVE_REUTILIZADA`.
6. Applying payment evidence is idempotent by the unique claim on `peyTransactionId`.
7. Liberación is guarded by `liberadoEn` being unset, inside the same mutation that sets it.

Money
8. All amounts are integer centavos inside PAYVRO (`…Centavos`). Conversion to and from pesos happens only in the pey adapter, with checked functions that reject more than two decimals instead of rounding.
9. Comparisons are integer equality. The cobro is compared with the transaction's `base`, and `base + tip + fee` must equal the total.

## Consequences

- A double click, a retry, a redeployed function or two tabs cannot create two charges.
- An unlucky timeout costs the owner one extra tap ("Reintentar") instead of a possible double charge.
- There is always a row to explain what happened: the bitácora shows the reservation, the call and its outcome.
- No floating-point surprise can make 149.00 differ from 149.00, and a card fee can never be mistaken for an underpayment or an overpayment.

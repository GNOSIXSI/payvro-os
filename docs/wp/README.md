# Work packages — PAYVRO OS

One file per package. A package is what one builder finishes in three hours or less, on one branch, in one PR.

Front matter: `id`, `title`, `lane`, `reviewers`, `depends_on`, `size` (S ≤ 1 h, M ≤ 2 h, L ≤ 3 h), `milestone`.
Body: Goal · Files it may touch · Files it must not touch · Steps · Done criterion · Out of scope · Risks.

Rules for whoever builds one
- Read `AGENTS.md`, `CONTEXT.md` and the sections of `ARCHITECTURE.md` your package names. Nothing else is assumed.
- "Files it may touch" is a hard boundary. If the work needs another file, stop and say so in the PR.
- The Done criterion lists exact commands. Paste their output in the PR. A command that does not pass is reported as failing, with its output.
- Every new test is seen failing first; the PR says how.
- You stop at a PR. You do not merge, deploy, spend or run a LIVE charge.

| WP | Title | Lane | Reviewers | Depends on | Size | Milestone |
|---|---|---|---|---|---|---|
| [WP-OS-01](WP-OS-01.md) | Esqueleto, compuertas y contrato | sol | sonnet | — | M | M1 |
| [WP-OS-02](WP-OS-02.md) | Motor en DEMO: estados, bitácora, idempotencia, simulador | astra | opus, gemini | 01 | L | M1 |
| [WP-OS-03](WP-OS-03.md) | pey LIVE: cliente, verificación, sondeo y barrido por intento | astra | opus, gemini | 02 | L | M1 |
| [WP-OS-04](WP-OS-04.md) | Página de pago y panel "Pedido que se libera" | cursor-grok | sonnet, gemini | 01 | L | M1 |
| [WP-OS-05](WP-OS-05.md) | Integración, E2E en DEMO e instalación por prompt | sol | sonnet, gemini | 02, 04 | M | M1 |
| [WP-OS-06](WP-OS-06.md) | Despliegue DEMO + LIVE y cobro real de $0.01 | sol | opus | 03, 05 | M | M1 |
| [WP-OS-07](WP-OS-07.md) | Timbre y barrido por listado | astra | opus, gemini | 03 | M | M2 |
| [WP-OS-08](WP-OS-08.md) | Cola de revisión, expiración, cancelación y pausa | sol | opus, gemini | 03 | M | M2 |
| [WP-OS-09](WP-OS-09.md) | Mostrador: QR CoDi de precio fijo | sol | sonnet, gemini | 07 | L | M2 |
| [WP-OS-10](WP-OS-10.md) | Endurecimiento | sol | opus, gemini | 05 | M | M2 |
| [WP-OS-11](WP-OS-11.md) | Motor versionado para Cloud | sol | sonnet | 07 | S | M2 |
| [WP-OS-12](WP-OS-12.md) | Plantillas de cita y de cotización | sol | sonnet, gemini | 08 | L | M2 |
| [WP-OS-13](WP-OS-13.md) | Acceso para agentes con alcance mínimo | astra | opus, gemini | 08, 10 | L | M2 |

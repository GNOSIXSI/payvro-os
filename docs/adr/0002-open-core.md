# ADR-0002 — Source-available core: PAYVRO OS (public, FSL-1.1-ALv2) and PAYVRO Cloud (private)

- Status: Accepted (updated by founder decision, 2026-11-14)

## Context

Facts
- The hackathon submission must be a public repository.
- The founders want a business after the hackathon: a hosted service with plans Gratis, Pro, Business and Enterprise.
- A jury cannot evaluate a private core.

Inference
- A business deciding whether to trust software that says "this was paid" benefits from being able to read the code that decides it.

## Decision

Two repositories.

| | PAYVRO OS | PAYVRO Cloud |
|---|---|---|
| Repo | `GNOSIXSI/payvro-os`, public, FSL-1.1-ALv2; converts to Apache-2.0 after two years | `GNOSIXSI/payvro-cloud`, private |
| For | The owner or developer who installs it with their own agent, also locally | Any business that wants to charge without installing anything |
| Tenancy | One business per install (ADR-0003) | Many businesses, one deployment |
| Contains | The whole engine, base templates, DEMO mode, install flow | Landing, onboarding, plans, tenant isolation, key vault, WhatsApp, agent |
| Is | The hackathon submission | The business |

The engine — verification, state machine, bitácora, pey client — is always in OS and available under FSL-1.1-ALv2. Cloud consumes it and never forks it (ADR-0008). Public copy describes the repository as código disponible (fair-code).

What goes where: if a business running alone needs it to charge and release safely, it belongs in OS. If it exists because many businesses share one service (isolation, billing, plan limits, staff tooling) or because it costs GNOSIX money per use (WhatsApp, a hosted agent), it belongs in Cloud.

## Consequences

- Security fixes to the engine are public by construction. Cloud must be able to take a new engine version within a day (ADR-0008 makes that a one-command sync).
- OS can never depend on anything private. Cloud can depend on OS.
- Nothing about Cloud's customers, prices under negotiation or pey conversations is written in this repo.
- The name PAYVRO and its logos are not licensed by FSL-1.1-ALv2; `TRADEMARKS.md` states the boundary.

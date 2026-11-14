# ADR-0003 — PAYVRO OS serves one business per installation

- Status: Accepted (locked by the founders, 2026-11-14)

## Context

Facts
- Each business charges into its own bank account with its own pey API key. Pooled accounts are prohibited by pey's terms (clause 5.4, as read by the founders) and by PAYVRO's own money rules.
- Multi-tenant isolation is the hardest security property of a payments product and needs negative tests, staff tooling and key custody.
- OS is installed by the owner's coding agent, possibly on a laptop.

## Decision

An OS install has exactly one negocio, one pey key, one destination account, one Convex deployment, one Clerk application.

- The pey key and the bank account id live in the deployment environment, not in the database.
- Who may operate the business is an explicit list (`PAYVRO_OWNER_EMAILS`). Signing in grants nothing by itself.
- There is no "create another business" anywhere in OS.

The data model still carries `negocioId` on every row, and `convex/motor` never resolves the business itself: it receives `negocioId` from its caller through the `PuertosMotor` interface. In OS that port returns the single row.

## Consequences

- No tenant-isolation bug class inside an install: there is no second tenant.
- A key leak affects one business.
- The same engine runs multi-tenant in Cloud by swapping the port implementation, with no change to engine code (ADR-0008).
- Agencies that run PAYVRO for several clients deploy one install per client, or use Cloud.
- The cost of the unused `negocioId` column in OS is one index prefix. Accepted.

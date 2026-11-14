# ADR-0008 — The engine lives in OS; Cloud consumes it by copy with provenance

- Status: Accepted (decided in the design pass of 2026-11-14; the founders delegated the "how")

## Context

Facts
- The engine must live in the public repo; Cloud consumes it (locked).
- The engine has two parts: pure TypeScript (state machine, money, verification policy, pey client, simulator, webhook check) and a Convex layer (tables, mutations, actions, crons).
- Convex functions are bundled from files inside the app's own `convex/` directory. Table definitions must be part of the app's `schema.ts`.
- npm cannot install a subdirectory of a git repository as a dependency. A TypeScript-source package installed from git would also need a build step that both the Next.js and the Convex bundlers accept.
- OS is public, so Cloud can read it without credentials.

Options considered
1. **Git dependency** on a package inside OS. Clean in theory. In practice: subdirectory installs are not supported by npm, the Convex layer cannot live in `node_modules` and still be the app's functions, and a build breaks in ways that are slow to debug the night before a deadline.
2. **Published npm package.** Adds a release process and a registry account, and still does not solve the Convex layer.
3. **Git submodule.** Works for files, but ties every Cloud checkout, CI run and Vercel build to submodule handling.
4. **Copy with provenance.** A script copies an exact set of paths from an OS commit into Cloud, writes a lock file with the commit and a hash per file, and a gate fails if any copied file differs.

## Decision

Option 4.

In OS
- The engine is exactly two directories: `packages/engine/` (pure) and `convex/motor/` (Convex layer). Nothing single-tenant is allowed inside them.
- `convex/motor` reaches the application only through the `PuertosMotor` interface it declares (`convex/motor/puertos.ts`): `resolverNegocio`, `credencialPey`, `urlsRetorno`, `ahora`. The application implements it in `convex/puertos.ts`.
- `convex/motor/tablas.ts` exports the engine's table definitions; the application's `schema.ts` spreads them in.
- `motor.manifest.json` at the repo root lists the exported paths and the engine version. Releases are tagged `motor-vX.Y.Z` (WP-OS-11).
- Engine tests run against a second, fake implementation of `PuertosMotor` with two businesses, so tenant-agnosticism is tested in OS even though OS has one tenant.

In Cloud
- `npm run motor:sync -- --ref <tag-or-sha>` copies the manifest's paths to the same locations and writes `motor.lock.json` (`repo`, `ref`, `commit`, `syncedAt`, `files: {path: sha256}`).
- `npm run motor:verificar` recomputes the hashes and fails on any difference. It is part of Cloud's gate.
- Cloud never edits a vendored file. A change to the engine is a PR in OS first, then a sync.

## Consequences

- Builds in both repos use plain local files: no registry, no submodule, no git auth.
- Provenance is explicit and checkable: for any Cloud commit, the lock file names the exact public commit of the code that decides "paid".
- Drift is impossible to merge by accident and trivial to see in review (the lock file changes).
- The engine's public surface (manifest paths, `PuertosMotor`, table names, internal function paths under `motor/`) becomes a contract. Breaking it needs a major version and a note in the tag.
- Cost: a sync step and duplicated bytes in Cloud. Accepted.
- Until WP-OS-11 tags a version, Cloud syncs from a commit sha.

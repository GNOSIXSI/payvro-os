# Dependency audit exceptions

`npm run audit` checks the production lockfile graph with `npm audit --omit=dev --audit-level=high`. A high or critical finding, including one inherited through another dependency, requires an exception for its underlying package and npm advisory ID. Registry errors and unreadable reports fail the gate.

The fenced JSON below is the list the gate reads. Each exception requires `paquete` (exact npm package name), `advisory` (numeric npm `source`), `vence` (`YYYY-MM-DD`, inclusive in UTC), and `motivo` (why the affected version cannot be replaced now, exposure/mitigation, and the plan to remove the exception). The gate checks the fields and date; the publication reviewer checks that the reason is sound. Remove the entry as soon as the affected version is gone.

No exceptions are granted.

```json
[]
```

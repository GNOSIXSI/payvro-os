# INSTALL — for the coding agent installing PAYVRO OS

You are a coding agent. A business owner asked you to install PAYVRO OS for **their** business. This file is written for you. Follow it top to bottom. The owner speaks Spanish (Mexico): talk to them in Spanish, short and plain.

What you are installing: an app where the owner creates a charge, the customer pays with CoDi, PAYVRO checks the payment directly with pey and only then marks the order as released. One business per installation. PAYVRO never touches the money and never charges a commission.

> **Status of this document (2026-11-15):** `npm run doctor` and `npm run smoke:demo` exist in this checkout. The clean-machine walk and sections 4–7 have not been run against a cloud deployment. Steps marked **[05]** are the checks that still need that deployment. If a command in this file does not exist in the checkout you cloned, stop and tell the owner which one; do not improvise a replacement that handles secrets.

## 0. Rules you must not break

1. **Never see a secret.** Do not ask the owner to paste the pey API key, a Clerk secret, a Convex deploy key or a webhook secret into the conversation. Do not `cat`, `echo`, `print`, log or commit a secret. Do not read `.env.local` back after the owner filled it. If a secret appears in your context by accident, say so and tell the owner to rotate it at the provider.
2. **Never write a CLABE anywhere.** Not in a file, not in a command, not in a note. PAYVRO needs the pey *bank account id* (an identifier), not the CLABE.
3. **Ask before anything that costs or commits:** creating accounts or cloud projects, deploying, choosing a paid plan, and every real charge. One explicit OK per action. An OK for one charge is not an OK for the next.
4. **DEMO first.** Do not configure LIVE until the DEMO smoke test passes.
5. **Report faithfully.** If a step fails, show the command and its output (with secrets absent by construction) and stop. Do not mark the install as done on a guess.
6. Do not modify application code to "make it work". If the install needs a code change, that is a bug: report it.

## 1. Decide the shape with the owner

Ask these, one message, in Spanish:

- ¿Quieres primero probarlo en modo DEMO (sin llaves, sin dinero real)? → always yes; it takes minutes.
- ¿Dónde va a correr? **A)** En internet con Vercel (tus clientes abren la página del cobro de PAYVRO). **B)** En esta computadora (modo local: tú muestras el QR CoDi; no hay página pública de PAYVRO).
- ¿Ya tienes cuenta en pey con tu llave de API y tu cuenta bancaria registrada y activa? (Si no: registrar una cuenta en pey tarda hasta 5 días hábiles; mientras tanto puedes usar DEMO.)

| | A · Vercel | B · Local |
|---|---|---|
| Customer opens | `https://<your-app>/pagar/cob_…` | The native CoDi QR shown in the panel; the pey payment link is the fallback |
| Needs | Vercel + Convex + Clerk accounts | Convex + Clerk accounts, this machine on while charging |
| How payment is detected | Polling while the page is open, sweep every minute, optional webhook | Polling while the panel is open, sweep every minute, optional webhook |
| Public URL | Yes | No |

In both shapes the payment truth is the same: an authenticated read to pey. The webhook is optional everywhere.

## 2. Prerequisites

Check, do not assume:

```bash
node --version     # must be v24.x
npm --version
git --version
```

If Node 24 is missing, tell the owner and offer to install it with their version manager. Do not install system packages without asking.

Accounts the owner needs (free tiers are enough to start; confirm with the owner before creating any): Convex, Clerk (LIVE only), Vercel (shape A only), pey (LIVE only).

## 3. Get the code and run DEMO

```bash
git clone https://github.com/GNOSIXSI/payvro-os.git
cd payvro-os
npm ci
```

Create the Convex project (this opens a browser for the owner to sign in; it creates a dev deployment and writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` into `.env.local`):

```bash
npx convex dev --once
```

Set the mode. `demo` is also the default when the variable is unset:

```bash
npx convex env set PAYVRO_MODE demo
```

Run it:

```bash
npm run dev
```

Open `http://localhost:3000`. You must see the `DEMO` tag. DEMO needs no Clerk keys and no pey keys.

### DEMO smoke test **[05]**

```bash
npm run smoke:demo
```

It must print `OK` for each line: cobro creado · intento creado (simulador) · pago simulado · pago verificado · liberado · bitácora con 5+ entradas · cero llamadas a pey.

Then let the owner see it: in the panel, "Nuevo cobro" → concepto "Prueba", monto $1.00 → "Copiar link" → open it → "Simular pago". The page must show **Pago verificado** and the panel **Liberado**.

If the smoke test fails, stop here. Do not go to LIVE.

Ask the owner: ¿Seguimos con LIVE (dinero real, empezando con un cobro de $0.01)? If not, you are done: tell them how to start it again (`npm run dev`).

## 4. LIVE configuration

LIVE is a **new, separate Convex deployment**. Never switch a DEMO deployment to live: DEMO data and LIVE data must not mix.

- Shape A: use the Convex **production** deployment of the project (created on first `npx convex deploy`).
- Shape B: create a second Convex project for LIVE (`npx convex dev --once --configure new`) so the DEMO one stays intact.

### 4.1 Clerk

The owner creates a Clerk application (sign-in with email or Google). Then:

1. In Clerk, activate the Convex integration (Clerk dashboard → Integrations → Convex). It shows the **issuer domain** (a URL, not a secret).
2. Recommended: in Clerk, restrict sign-ups (allowlist or invitation only). PAYVRO also enforces its own owner list.
3. Values:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` → the Next.js side. The **owner** pastes them into `.env.local` (shape B) or into the Vercel project settings (shape A). You do not open the file afterwards.
   - `CLERK_JWT_ISSUER_DOMAIN` → Convex environment. Not secret; you may set it:
     ```bash
     npx convex env set CLERK_JWT_ISSUER_DOMAIN "<issuer domain shown by Clerk>"
     ```

### 4.2 Owner list

Only these people can operate the business. The owner types it (it is personal data: do not write it into any file):

```bash
npx convex env set PAYVRO_OWNER_EMAILS
```

If the CLI does not prompt for the value, have the owner set it in the Convex dashboard (Settings → Environment Variables). Comma-separated, no spaces.

### 4.3 pey key and bank account id — the owner's hands, not yours

Tell the owner, in Spanish:

> Necesito que tú pongas dos datos en el panel de Convex. No me los pegues aquí.
> 1. Abre el panel de Convex de tu proyecto → Settings → Environment Variables.
> 2. Agrega `PEY_API_KEY` con tu llave de API de pey.
> 3. Agrega `PEY_BANK_ACCOUNT_ID` con el **id de pey** de tu cuenta bancaria registrada (empieza parecido a `01J…`). No es tu CLABE.
> 4. Avísame cuando esté listo.

Why the dashboard: the value goes from the owner's clipboard to Convex without passing through you, your logs or the shell history.

Then set the mode on the LIVE deployment:

```bash
npx convex env set PAYVRO_MODE live
```

### 4.4 Check without seeing **[05]**

```bash
npm run doctor
```

`doctor` prints one line per variable with `presente` or `falta`, never a value, and asks pey for the status of the bank account. Required result for LIVE:

```
PAYVRO_MODE            presente (live)
PEY_API_KEY            presente
PEY_BANK_ACCOUNT_ID    presente
CLERK_JWT_ISSUER_DOMAIN presente
PAYVRO_OWNER_EMAILS    presente (N)
cuenta en pey          ACTIVE
```

If the account is `PENDING` or `PROCESSING`: it is not ready (pey says up to 5 business days). Stay in DEMO and tell the owner. If `ERROR`: the owner must fix it with pey. Do not try another account id.

## 5A. Deploy to Vercel

Confirm with the owner before creating the project.

1. Import the repository into Vercel (or `npx vercel link`).
2. In the Vercel project → Settings → Environment Variables, the **owner** adds `CONVEX_DEPLOY_KEY` (from the Convex dashboard → Settings → Deploy keys → production). For LIVE, also `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`; a DEMO site runs without them.
   Before the first deploy, set `CLERK_JWT_ISSUER_DOMAIN` on the Convex **production** deployment, even for DEMO: the push validates `convex/auth.config.ts` and fails if the variable is missing. Use the Clerk Frontend API URL; it is not a secret. Without Clerk, a non-secret placeholder such as `https://issuer.ejemplo.invalid` works, as `e2e/servidor.sh` does.
3. Build command: `npx convex deploy --cmd 'npm run build'`. This deploys the Convex functions and injects `NEXT_PUBLIC_CONVEX_URL` into the build.
4. After the first deploy, set the public origin on the Convex production deployment (no trailing slash):
   ```bash
   npx convex env set --prod PAYVRO_PUBLIC_URL "https://<the-vercel-domain>"
   ```
5. In Clerk, add the Vercel domain to the allowed origins.
6. Open the site. Sign in with an email from the owner list. You must see the panel **without** the DEMO tag. Sign in with any other account: you must be refused.

Merging is not deploying: open the deployed URL and check it yourself.

## 5B. Run locally (no public URL)

```bash
npm run dev
```

What changes in local mode:
- The customer cannot open `localhost`. The owner shows the **native CoDi QR** from the panel; the pey payment link ("Pagar con link") is the fallback.
- After paying, the customer lands on a small page served by Convex that says the payment is being verified.
- Detection relies on polling: every 1–2 s while the charge is open in the panel, and a sweep every minute otherwise. Keep `npm run dev` running while charging; the sweep itself runs in Convex and keeps working if the laptop sleeps.
- Use `npx convex dev` against a Convex **cloud** dev deployment. A fully offline Convex backend has no HTTPS URL, and pey requires HTTPS return URLs for payment links.

## 6. Optional: webhook

Not required. It only makes detection faster when nobody has the charge open.

1. The endpoint is `https://<your-convex-deployment>.convex.site/webhooks/pey` (the `.convex.site` URL is shown in the Convex dashboard). It is public HTTPS in both shapes.
2. The owner registers that URL in pey and copies the signing secret into the Convex environment as `PEY_WEBHOOK_SECRET` (dashboard, same as §4.3).
3. Without the secret the route answers 503 by design.

pey sends each event once and does not retry, so PAYVRO never depends on it.

## 7. The $0.01 test charge

Ask, in Spanish, and wait for a clear yes: "¿Hago un cobro real de un centavo ($0.01 MXN) para probar? Tú lo pagas desde tu app bancaria con CoDi y el dinero llega a tu propia cuenta."

1. Sign in to the panel as the owner. "Nuevo cobro" → concepto `Prueba PAYVRO`, monto `0.01`.
2. Expected within a few seconds: state **Esperando pago** and a native CoDi QR with a fixed amount and 24-hour expiration. The pey payment link is offered as a fallback when the QR intento is terminal or expired.
3. The owner scans the QR with their bank app and pays with CoDi.
4. Expected: the panel changes to **Pago verificado** and then **Liberado** without anyone touching it. Typical: under 20 s after the bank confirms (a target, not a measured guarantee).
5. Open the cobro → bitácora. It must show, in order: `cobro.creado`, `intento.reservado`, `pey.llamada`, `intento.creado`, `pago.verificado`, `cobro.liberado`.

If it stays in **Esperando pago** for more than 2 minutes after paying: do not create another charge. Run `npm run doctor`, read the bitácora of that cobro, and report what the last entry says.
If it goes to **En revisión**: that is PAYVRO refusing to release something that does not match (amount, method or account). Report the reason shown; do not try to force it.

## 8. Hand-over

Tell the owner, in Spanish:
- The address of the panel and who can sign in.
- How to create a charge, show the CoDi QR or use the fallback payment link, and what each state means: Esperando pago · Pago verificado · Liberado · En revisión.
- That PAYVRO never asks for and never shows their CLABE or their key.
- How to stop charging: remove `PEY_API_KEY` in the Convex dashboard. Charges stop immediately.
- How to rotate the key: create a new one in pey, replace it in Convex, delete the old one in pey.
- Where the code is and that it is available under FSL-1.1-ALv2, converting to Apache-2.0 after two years.

Leave no secret in the shell history, in notes or in files you created. Delete any temporary file you wrote.

## 9. Troubleshooting

| Symptom | Cause | Do |
|---|---|---|
| `DEMO` tag shows on the LIVE site | `PAYVRO_MODE` unset on that deployment | Set it on the right deployment (`--prod` for production). |
| `NO_AUTORIZADO` after sign-in | Email not in `PAYVRO_OWNER_EMAILS`, or not verified in Clerk | Owner fixes the list; verify the email. |
| `CUENTA_NO_ACTIVA` when creating a charge | pey account not `ACTIVE` | Wait for pey; stay in DEMO. |
| Charge stuck in "Creando…" then "No se pudo crear" | pey rejected the request (bitácora shows the http status and pey's `requestId`) | Report it; give the `requestId` to pey support. |
| `next build` fails with linked `node_modules` | Worktree with symlinked dependencies | `rm -rf node_modules && npm ci` in that directory. |
| Webhook returns 401 | Wrong signing secret | Owner re-copies it from pey. |
| Webhook returns 503 | Secret not set | Expected. Set it or ignore webhooks. |

<p align="center">
  <img src="public/brand/payvro-logo-claro.svg" alt="PAYVRO" width="320">
</p>

# PAYVRO OS

**Cobra y libera, sin comprobantes.**

Hoy cobrar por transferencia en México es «pásame tu CLABE», «mándame tu comprobante», abrir la banca y comparar. Una captura de pantalla no es un pago.

PAYVRO hace esto: creas un cobro, tu cliente paga con CoDi desde la app de su banco, PAYVRO le pregunta directo a pey si el dinero llegó a tu cuenta por el monto correcto y, solo entonces, libera el pedido. Sin capturas y sin revisar tu banca.

- El dinero va directo de tu cliente a tu cuenta. PAYVRO no toca el dinero.
- Sin comisión. Ni por pago, ni porcentaje, nunca.
- Si algo no cuadra (otro monto, pago doble), el cobro pasa a **En revisión** y no se libera solo.
- Todo queda en una bitácora que tú puedes leer.

PAYVRO OS es la versión abierta: una instalación para un negocio, con tus propias cuentas y tu propia llave de pey. La instala tu agente de código, también en tu computadora.

> **Estado:** en construcción, en público, durante el Hackatón México (14-nov a 12-dic de 2026). Lo que ya funciona y lo que falta está en [`PLAN.md`](PLAN.md). El diario de construcción está en [`docs/bitacora/`](docs/bitacora/).

## Pruébalo en un minuto (modo DEMO)

El modo DEMO no usa llaves ni dinero real: un simulador hace el papel de pey.

1. Abre la demo en vivo: _el enlace se publica aquí al cierre del hito 1 (domingo 15-nov)._
2. En el panel, toca **Nuevo cobro**. Escribe un concepto y un monto.
3. Toca **Copiar link** y ábrelo: es lo que ve tu cliente.
4. Toca **Simular pago**.
5. La página cambia a **Pago verificado** y en el panel el pedido aparece como **Liberado**.

Para correr la DEMO en tu computadora:

```bash
git clone https://github.com/GNOSIXSI/payvro-os.git
cd payvro-os
npm ci
npx convex dev --once
npm run dev
```

## Instálalo para tu negocio

Dile esto a tu agente de código (Claude Code, Cursor, Codex u otro):

```text
Lee INSTALL.md de github.com/GNOSIXSI/payvro-os e instálame PAYVRO.
```

El agente te guía: primero la DEMO, luego tus cuentas, y al final un cobro real de un centavo para comprobar que todo funciona. Tu llave de pey la pones tú en el panel de Convex; el agente nunca la ve. PAYVRO nunca te pide tu CLABE.

Necesitas una cuenta de pey con tu cuenta bancaria registrada y activa. pey indica que el registro tarda hasta 5 días hábiles; mientras tanto puedes usar la DEMO.

## Cómo funciona

Un solo motor, cuatro pasos:

| | Paso | Qué pasa |
|---|---|---|
| 1 | **Intención** | Un pedido, una cita o una cotización. |
| 2 | **Cobro CoDi** | PAYVRO crea un link de pago con la API de pey. |
| 3 | **Pago verificado** | PAYVRO consulta a pey con tu llave y compara monto y cuenta. |
| 4 | **Liberación** | El pedido pasa a «Liberado» y queda en la bitácora. |

La verdad del pago es siempre una consulta autenticada a pey. El aviso que manda pey (webhook) solo sirve de timbre: nos dice que vayamos a preguntar. Un barrido periódico rescata los avisos que se pierdan.

La primera plantilla es **Pedido que se libera**, pensada para quien vende por WhatsApp o Instagram. Siguen anticipo de cita, cotización que arranca y mostrador.

Hecho con Next.js, Clerk, Convex y la API de pey. El detalle está en [`ARCHITECTURE.md`](ARCHITECTURE.md) y las razones de cada decisión en [`docs/adr/`](docs/adr/).

## Para agentes y para quien quiera contribuir

| Archivo | Para qué |
|---|---|
| [`INSTALL.md`](INSTALL.md) | Instalar PAYVRO para un negocio (lo lee el agente del dueño). |
| [`AGENTS.md`](AGENTS.md) | Reglas para trabajar en este repositorio. |
| [`CONTEXT.md`](CONTEXT.md) | El vocabulario y las reglas que no se rompen. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Módulos, datos, estados y flujos. |
| [`SECURITY.md`](SECURITY.md) | Modelo de amenazas y cómo reportar una vulnerabilidad. |
| [`PLAN.md`](PLAN.md) | Hitos y paquetes de trabajo. |

## PAYVRO OS y PAYVRO Cloud

El motor es abierto; la nube es el servicio. PAYVRO OS (este repositorio, MIT) es para quien quiere instalarlo y operarlo por su cuenta. PAYVRO Cloud es el servicio hospedado por GNOSIX para quien prefiere no instalar nada. Los dos usan el mismo motor.

## Licencia

Código bajo licencia [MIT](LICENSE). © 2026 GNOSIX.
El nombre PAYVRO y sus logos no forman parte de la licencia MIT; ver [`public/brand/README.md`](public/brand/README.md).

## Créditos

- Los pagos CoDi se crean y se consultan con la [API pública de pey](https://docs.pey.mx). Gracias al equipo de pey por la API y por las cuentas de prueba del hackatón.
- Construido por el equipo GNOSIX (Ulises Arellano y Ricardo Rosenzweig) para el Hackatón México.

PAYVRO es un proyecto independiente. No está afiliado a pey, Banxico ni CoDi, ni cuenta con su aval. CoDi es una plataforma de Banco de México.

# PAYVRO · Referencia de diseño

Resultado de la pasada de UX del 14 de noviembre de 2026. Es la referencia para quien construya PAYVRO Cloud y PAYVRO OS.

- **Prototipo:** `payvro-pantallas-ux.html`. Un solo archivo autocontenido (HTML, CSS, JS y los SVG oficiales del logo). Se abre en el navegador, sin instalar nada.
- **Qué es:** 13 pantallas, 81 estados y 13 diálogos, todos clicables. Arriba se cambia la edición (Cloud u OS), la vista (escritorio, tablet, móvil), el plan y si la cuenta está en DEMO o validada.
- **Qué no es:** código de producción. Está escrito en JS plano, no en React. Sirve como referencia de pantallas, estados, copy y tokens; los componentes se reconstruyen en Next.js + Tailwind + shadcn.
- **Datos:** todo es de ejemplo. Las llaves que aparecen (`ejemplo-de-llave`, `pv_live_ejemplo_no_real_7f3a`) son marcadores, no secretos.

## Reglas de UX que el prototipo respeta

- Nada dice «pagado» hasta que pey lo confirma. El ámbar solo significa «Esperando pago».
- Todo estado lleva texto e icono, nunca solo color.
- Cada cobro muestra su folio y su línea de tiempo. Cada error dice qué pasó y qué hacer.
- Un cobro en revisión nunca se libera solo.
- PAYVRO no toca el dinero y no hace devoluciones: pey no tiene esa función.
- pey no permite anular un cobro. Un pago posterior entra a «En revisión · pago tardío».
- Accesibilidad AA: foco visible, contraste revisado en los 81 estados (escritorio y móvil), movimiento de 160–200 ms y ninguno con movimiento reducido. No se probó con lector de pantalla ni en un teléfono real.

## Pantallas y estados

| # | Pantalla | Quién | Estados |
|---|---|---|---|
| 1 | Landing (Cloud) | Visitante | Completa |
| 2 | Registro e ingreso | Dueño | Registro · Registro con código · Código incorrecto · Correo ya registrado · Ingreso · Contraseña incorrecta |
| 3 | Onboarding | Dueño, primera vez | Giro · Tu negocio · Ya tengo cuenta pey · Verificando llave · Llave rechazada · Conexión verificada · Ayúdame a abrir mi cuenta · CLABE incompleta · En validación |
| 4 | Panel del dueño | Dueño | Con cobros · Primera vez · Cargando · Sin resultados · Sin conexión |
| 5 | Nuevo cobro | Dueño, por plantilla | Formulario · Monto inválido · Creando · pey no respondió · Link y QR listos |
| 6 | Detalle del cobro | Dueño | Esperando pago · Pago verificado · Liberado · En revisión · Expirado · Cerrado sin liberar · Cargando · No encontrado |
| 7 | Página de pago del cliente | Cliente, pública, móvil primero | Esperando pago · Solicitud enviada · Número sin CoDi · Verificando · Pago verificado · Expirado · En revisión · Cerrado sin liberar · Cargando · Sin conexión · Link inválido |
| 8 | Flujo «En revisión» | Dueño o administrador | Monto distinto · Cuenta distinta · Pago duplicado · Pago tardío |
| 9 | Plantillas | Dueño | Galería · Reglas de plantilla · Membresías · Membresías vacío |
| 10 | Plan y facturación | Dueño | Planes · Facturación · Suscripción sin cobrar |
| 11 | Ajustes | Dueño | Negocio · Equipo y roles · Conexión pey · Conexión con error · API y webhooks · API vacío · WhatsApp y agente (OS) · Bitácora de seguridad · Bitácora vacía |
| 12 | Modo Mostrador | Cajero, tablet o teléfono en caja | Teclado · QR esperando pago · Recibiste $X · Revisa este pago · QR vencido · Sin conexión · Etiquetas QR · Etiquetas vacío |
| 13 | PAYVRO OS · Instalado por tu agente | Dueño, primer arranque | Instalación lista · Usuario dueño · Tu negocio · Conectar pey · Verificando · Llave rechazada · Conexión verificada · Probar en DEMO |

### Estados de un cobro

Esperando pago · Pago verificado · Liberado · En revisión (con la variante «pago tardío») · Expirado · Cerrado sin liberar.

- La liberación es automática por defecto. Una plantilla puede pedir confirmación del dueño (por ejemplo, Cotización); entonces el cobro se queda en «Pago verificado» hasta que el dueño libera.
- «Cerrado sin liberar» es un estado final, gris, con el motivo y quién lo decidió. Se llega desde «No liberar» en una revisión o desde «Dejar de esperar este cobro» (motivo: «El dueño dejó de esperarlo»).
- Salidas de «En revisión»: «Liberar con lo recibido», «Pedir la diferencia» (crea un cobro nuevo por el faltante) y «No liberar» (con la opción de anotar «devolución hecha por fuera»). La que no aplica se muestra desactivada, con su motivo en una línea.

### Estados de una membresía

Al corriente · Pendiente de pago · Pausada por falta de pago.

- Cada mes se envía un link de pago que dura 7 días, más un aviso rápido por CoDi el día 0.
- Recordatorios el día 1 y el día 3, último aviso el día 5 («Último aviso: tu membresía se pausa en 2 días»), pausa el día 7. El dueño configura los días.
- Pausada: el dueño reactiva, da más días o da de baja. Si el cliente paga, se reactiva sola.
- En Gratis los avisos al cliente van por correo y el dueño tiene «Reenviar cobro». En Pro salen por WhatsApp, con correo de respaldo.

### Flujo principal (igual a la slide 6 de la presentación)

Crear cuenta → giro → tu negocio → nuevo cobro → página del cliente → «Pago verificado con pey · Pedido #128 liberado».

Diferencias deliberadas con la slide:

- Los colores de negocio son petróleo, tinta, vino, canela y azul. El magenta y el naranja de la slide no pasan AA con texto blanco.
- En «Tu negocio», la CLABE dice «Sin conectar · empiezas en DEMO», con los dos caminos de pey como desvío opcional.
- Los montos llevan centavos (`$450.00`).
- En la página del cliente, debajo del QR está «recibe la solicitud en tu celular», para quien abre el link en su teléfono.
- Con correo, el código de un solo uso aparece dentro de la misma pantalla de registro. Con Google se entra directo.

## Diálogos

| Diálogo | Cuándo aparece |
|---|---|
| Envía el cobro por WhatsApp desde aquí | Gratis intenta enviar por WhatsApp |
| Invita a tu equipo | Gratis intenta invitar a otro usuario |
| Usa todas las plantillas | Se toca una plantilla de otro plan |
| API, MCP y webhooks | Se toca algo de Business |
| Cambiar tu plantilla gratis | Gratis elige otra plantilla como la suya |
| ¿Dejar de esperar este cobro? | Detalle y Mostrador; pasa a «Cerrado sin liberar» |
| No liberar este cobro | Revisión; permite anotar «devolución hecha por fuera» |
| Llave de pey | Pegar o reemplazar la llave |
| Llave creada | Llave de API de PAYVRO; se muestra una sola vez |
| ¿Revocar esta llave? | API y webhooks |
| ¿Bajar al plan Gratis? | Facturación |
| ¿Dar de baja esta membresía? | Membresías |
| Conecta tu número de WhatsApp | OS, al enviar por WhatsApp sin número conectado |

Los diálogos de mejora de plan siempre tienen «Ahora no» y nunca bloquean un cobro en curso.

## Planes y ediciones, como quedaron dibujados

| | Gratis | Pro | Business | OS |
|---|---|---|---|---|
| Plantillas | 1, la que elijas (cualquiera menos Checkout) | Todas menos Checkout | Todas | Todas |
| Usuarios | 1 | Dueño, Administrador y Cajero | Más sucursales, roles por sucursal y permisos finos | Como Business |
| WhatsApp | Copiar link | Desde la interfaz | Desde la interfaz | Con número propio |
| Agente | No | Sí, como función | Sí | Con modelo propio |
| API, MCP y webhooks | No | No | Sí | Sí |
| Marca propia | «Cobro creado con PAYVRO» | Sin esa línea | Sin esa línea | Sin esa línea |

PAYVRO OS no incluye: más de un negocio por instalación, Plan y facturación, «Ayúdame a abrir mi cuenta pey», consola de soporte, SLA ni respaldos administrados. Su primer arranque crea al usuario dueño y el perfil del negocio, y después pide la llave y la cuenta de pey o deja seguir en DEMO.

Cuota fija mensual por plan. Nunca por pago ni comisión sobre CoDi.

## Componentes a construir

| Componente | Base shadcn/Radix | Notas |
|---|---|---|
| `StatusBadge` | Badge | 6 estados de cobro y 3 de membresía; siempre icono + texto |
| `ChargeTimeline` | propio | Hecho, actual, pendiente; variantes revisión, expirado y cerrado |
| `ChargeTable` / `ChargeCard` | Table / Card | Tabla en escritorio, tarjetas en móvil |
| `EventLog` | Table | Bitácora del cobro y de seguridad |
| `KpiCard` | Card | «Cobrado hoy» solo suma verificado y liberado |
| `QrDisplay` | propio | Sin logo encima; con texto alternativo |
| `AmountInput` / `AmountPad` | Input / propio | Teclas de 68 px en Mostrador |
| `TemplateTabs` / `TemplateCard` | Tabs / Card | Tres bloqueos: otra plantilla, Pro, Business |
| `TemplateRulesForm` | Form | Vigencia, liberación y calendario de Membresía |
| `MembershipTable` | Table | Reenviar cobro, reactivar, dar más días, dar de baja |
| `PlanCard` / `UpgradeDialog` | Card / Dialog | Siempre con «Ahora no» |
| `DemoBanner` | Alert | Fijo mientras la cuenta esté en DEMO |
| `Stepper` / `OptionCard` | propio / RadioGroup | Onboarding Cloud y primer arranque OS |
| `SecretField` | Input | Llave de pey: nunca se vuelve a mostrar, solo se reemplaza |
| `OtpField` | InputOTP | Dentro del registro, sin paso extra |
| `MismatchTable` / `DecisionCard` | Table / Card | Las salidas que no aplican van desactivadas con su motivo |
| `ConnectionCard` | Card | OS: «Conecta tu número de WhatsApp» y «Conecta tu modelo» |
| `PayPage` | propio | Marca del negocio, estado en vivo |
| `Skeleton` | Skeleton | Estados de carga |
| `ColorSwatches` | ToggleGroup | Solo colores que pasan AA con texto blanco |
| `ConfirmDialog` | AlertDialog | Acciones que no se deshacen |
| `Toast` | Sonner | Confirmaciones breves |
| `AppShell` | propio | Barra lateral en escritorio, pestañas abajo en móvil; oculta Plan en OS |

## Tokens de diseño

### Color

| Token | Valor | Uso |
|---|---|---|
| `ink` | `#142B3B` | Texto, fondos oscuros |
| `paper` | `#F5F3EC` | Fondo |
| `pet` | `#076B76` | Botón principal y enlaces |
| `pet-hover` | `#055A63` | Hover del botón principal |
| `pet-soft` | `#E4F1F1` | Fondo de avisos informativos y selección |
| `muted` | `#50636E` | Texto secundario |
| `line` | `#D7DEDE` | Divisores y bordes |
| `card` | `#FFFFFF` | Tarjetas |
| `field` | `#FBFAF6` | Fondo de campos |

Acentos del nudo, solo para numeración y decoración, nunca para estado: `#00B8B2`, `#EF006D`, `#FFC400`, `#FF7900`. Sobre fucsia el número va en blanco, a 19 px y en negrita.

| Estado | Fondo | Texto | Borde |
|---|---|---|---|
| Esperando pago | `#FFF2C2` | `#5A4300` | `#E2BE45` |
| Pago verificado | `#D6F2F0` | `#04575F` | `#8ED6D2` |
| Liberado | `#076B76` | `#FFFFFF` | — |
| En revisión | `#FFE4CC` | `#7A3500` | `#F2B27A` |
| Expirado y Cerrado sin liberar | `#E9ECEC` | `#3F4F58` | `#C3CCCC` |
| Error | `#FBE9E7` | `#A4241C` | `#E2B1AC` |

Expirado y Cerrado sin liberar comparten gris (contraste 7.15:1) y se distinguen por icono y texto.

Colores de negocio para la página de pago: `#076B76`, `#142B3B`, `#9A2A5B`, `#8A4B00`, `#3B4FA0`.

### Tipografía

- Titulares: Noto Sans Display 700.
- Cuerpo y producto: Noto Sans 400 y 600.
- Cifras tabulares en montos y folios.
- El wordmark PAYVRO es el SVG oficial de `01-svg`; no se escribe con una fuente.

### Forma, movimiento y cortes

- Radio: 12 px en tarjetas y botones, 8 px en campos, 999 px en insignias.
- Objetivo táctil: 44 px; 68 px en el teclado de Mostrador.
- Movimiento: 160–200 ms con salida suave; ninguno con movimiento reducido.
- Cortes de ancho por contenedor: 600 px y 860 px.

## Lo que sigue provisional

1. **Vigencias.** Marcadas «Por validar»: Pedido, 24 h; Anticipo de cita, hasta 2 h antes de la cita; Cotización, 7 días; Mostrador, etiquetas sin vencimiento y monto libre de 15 min. Son configurables por plantilla.
2. **Alta de cuenta pey.** El formulario (tipo de persona, nombre o razón social, RFC, correo, celular y CLABE a su nombre) está marcado «Por confirmar con pey».
3. **Precios.** No hay. Los planes de pago dicen «Cuota fija mensual · precio por definir».
4. **Dominio.** `payvro.example` es un marcador.
5. **Canon de marca.** El Brand Canon v1 describe otro producto («Comercio desde tu agente»). Aquí se usó su sistema visual y su voz; el producto y el copy vienen del brief y de la presentación v2. El canon se actualiza aparte.

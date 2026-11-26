# Alta del dueño en PAYVRO OS LIVE

Guía para el fundador con acceso administrativo a Clerk, Convex y al alojamiento de Next.js. El alta crea el perfil de un solo negocio; no registra una cuenta bancaria, no contacta a pey y no crea cobros.

## 1. Preparar la identidad

1. Usa una aplicación Clerk exclusiva de LIVE. En su dashboard, restringe el registro a invitaciones y autoriza solo a los dueños que operarán el negocio. Cada dueño debe verificar su correo en Clerk. Iniciar sesión en Clerk no basta para entrar al panel.
2. En **JWT Templates**, crea la plantilla **Convex** con nombre `convex`. Comprueba que el token tenga audiencia `convex` y los claims `email` y `email_verified` del **correo primario verificado**. Si la plantilla no los incluye, usa los shortcodes de Clerk `{{user.primary_email_address}}` y `{{user.email_verified}}`, respectivamente; la verificación debe llegar como booleano, no como texto. No sustituyas estos claims por metadatos editables por el usuario. Usa el emisor de esta misma instancia para Convex.

## 2. Configurar los dos servicios de LIVE

1. Usa un deployment cloud dev **nuevo y vacío** de Convex, en un proyecto separado de DEMO. No cambies de modo una instalación DEMO ni reutilices sus filas. En **Settings → Environment Variables**, pon `PAYVRO_MODE` en `live`, `CLERK_JWT_ISSUER_DOMAIN` en la URL HTTPS del emisor Clerk de la plantilla y `PAYVRO_OWNER_EMAILS` en la lista de correos primarios permitidos, separados por comas. No incluyas correos de prueba ni listas amplias.
2. Carga las funciones desde una copia limpia del commit aprobado, con las dependencias del lockfile ya disponibles. Con tu sesión administrativa de Convex, crea fuera del repo un archivo selector con una sola línea `CONVEX_DEPLOYMENT=dev:<nombre-del-deployment>` (sustituye el marcador por el nombre del dashboard; no es una credencial). Verifica que coincide con el deployment LIVE vacío y ejecuta desde esa copia:

   ```sh
   ./node_modules/.bin/convex dev --once --codegen disable --env-file <ruta-al-selector>
   ```

   Reemplaza `<ruta-al-selector>` por la ruta al archivo. Si el destino no coincide o la carga falla, detente. En **Functions** debe aparecer `instalacion:instalarLive` antes de pasar a la sección 3.
3. Configura `NEXT_PUBLIC_CONVEX_URL` con la URL de ese Convex, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` con la clave publicable de esa instancia de Clerk y `CLERK_SECRET_KEY` con su clave privada. Para el camino local del ADR-0007, carga los valores desde un gestor de secretos al proceso y ejecuta `./node_modules/.bin/next dev` desde el mismo commit; usa una instancia Clerk dedicada que admita `localhost`. Si alojas Next.js, pon los valores en el proyecto LIVE (por ejemplo, **Vercel → Settings → Environment Variables**) y construye ese mismo commit. Si cambian los valores `NEXT_PUBLIC_`, reinicia Next.js local o vuelve a construir el sitio. Nunca pongas el secreto bajo un nombre `NEXT_PUBLIC_`.
4. Introduce los secretos en los proveedores o en el gestor local, nunca en chats, código, capturas, archivos del repo ni bitácoras. Confirma que Next.js y Convex usan el mismo commit aprobado y los proyectos de LIVE correctos antes de ejecutar el alta.

## 3. Ejecutar el alta administrativa

1. En el dashboard de **ese** deployment Convex, abre **Functions** y selecciona la mutación interna `instalacion:instalarLive`. Usa **Run Function** con un perfil inicial. Ejemplo ficticio (reemplaza solo el perfil):

   ```json
   { "nombre": "Dulces Ana — Ejemplo", "giro": "social", "colorMarca": "#076B76" }
   ```

   `nombre` acepta de 1 a 40 caracteres después de quitar los espacios de los extremos. `giro`: `social`, `citas`, `cotizaciones`, `mostrador`, `membresias`, `tienda`. Colores: `#076B76`, `#EF006D`, `#FF7900`, `#142B3B`. No hay campo de cuenta bancaria, modo ni dueño.
2. La primera ejecución devuelve `{ "creado": true }`. En **Data → negocios** debe haber una sola fila LIVE. Una repetición devuelve `{ "creado": false }` y no cambia la fila, ni siquiera si el perfil enviado es diferente. Para editar el perfil utiliza **Ajustes** como dueño; no borres la fila para reintentar. Ante un error de modo o más de una fila, detén el alta y verifica el deployment.

## 4. Comprobar el acceso, sin cobrar

1. En una ventana privada, abre `/panel`: debe llevarte a `/entrar`. Entra con la cuenta del dueño de correo verificado incluido en la lista: debe cargar el panel. No pulses **Crear cobro**.
2. En otra sesión de navegador aislada, comprueba que una cuenta sin correo verificado o fuera de la lista no ve las herramientas del panel. Cierra esa sesión de navegador para volver a probar con el dueño. Si el dueño legítimo recibe la negativa, comprueba emisor, plantilla, verificación y lista; no abras el registro ni quites las guardas. Al retirar un dueño de la lista, revoca también su sesión desde Clerk.
3. El pagador usa `/pagar/<id-del-cobro>` sin iniciar sesión. DEMO sigue en su instalación separada y no requiere Clerk.

El alta deja la cuenta sin verificar. El aprovisionamiento de pey, la comprobación de cuenta activa y el primer cobro real requieren un paso separado (PV-03). No los ejecutes como parte de esta guía.

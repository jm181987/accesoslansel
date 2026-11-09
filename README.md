# Accesos LANSEL

Portal corporativo para administrar los accesos de los funcionarios a plataformas de trabajo. Incluye una aplicación web con roles de **administrador** y **funcionario**, y la extensión **LANSEL Access** para Chrome y Edge.

- **Aplicación:** https://accesoslansel.vercel.app/
- **Extensión:** carpeta [`extension/`](extension/)
- **Versión de la extensión:** **1.3.3** (consultar [`extension/manifest.json`](extension/manifest.json) para la versión vigente).

## Novedades de la versión 1.3.3

- **Identidad KNJ:** logo en el encabezado y pantalla de inicio de sesión del portal, favicon web e iconos de la extensión (16, 32, 48 y 128 px). Recursos: [`public/knj-logo.png`](public/knj-logo.png) y [`extension/icons/`](extension/icons/).
- **Administración por pestañas:** Asignar acceso, Editar accesos, Funcionarios y Extensiones; búsqueda de funcionarios por nombre o correo.
- **Control centralizado de versiones:** en **Administración → Extensiones**, el administrador consulta la última versión reportada por funcionario, fecha de conexión y estado de vinculación; botón **Actualizar listado**.
- **Reporte de versión al autenticar:** desde v1.3.3 la extensión incluye `X-LANSEL-Extension-Version` en sus solicitudes autenticadas. Al consultar `GET /api/extension/me`, el servidor valida el token y registra versión y última conexión en `extension_tokens`.
- **Autocompletado VoiceSpin:** el campo **Agent** y el campo **Extension** reciben el mismo número de usuario de cuatro dígitos; **Extension Secret** recibe la contraseña asignada. Los formularios externos pueden cambiar y requieren validación real.

## Funcionalidades

| Funcionario | Administrador |
| --- | --- |
| Iniciar sesión y consultar únicamente sus accesos | Crear funcionarios y activar/desactivar cuentas |
| Abrir las plataformas asignadas | Asignar accesos con URL, usuario y contraseña |
| Consultar/copiar sus credenciales desde el portal | Editar y eliminar accesos existentes |
| Vincular la extensión y completar credenciales en sitios compatibles | Generar códigos de vinculación por funcionario, revocar vinculaciones y consultar versiones reportadas |

La aplicación separa los accesos por `employee_id` en el servidor; la extensión solo consulta los accesos del funcionario asociado a su token.

## Extensión Chrome / Edge

### Instalar o actualizar

1. Descargar el repositorio desde **Code → Download ZIP** y descomprimirlo.
2. Abrir `chrome://extensions` (Chrome) o `edge://extensions` (Edge).
3. Activar **Modo desarrollador**.
4. Seleccionar **Cargar descomprimida** y elegir la carpeta `extension/`.
5. Si ya está instalada desde una carpeta local, actualizar los archivos de **esa misma carpeta** y pulsar **Recargar**. Si se instala desde una carpeta distinta como extensión nueva, habrá que vincularla de nuevo.
6. Abrir la extensión tras actualizarla; en su parte inferior se muestra la versión obtenida del manifiesto. El administrador podrá verla después de que la extensión autentique su sesión y registre la versión.

> **Actualizaciones:** una extensión instalada como **descomprimida** no se actualiza automáticamente desde GitHub. Para actualizaciones automáticas reales se requiere distribución administrada o publicación mediante Chrome Web Store / Microsoft Edge Add-ons. La versión del servidor también debe estar desplegada en Vercel para que las funciones nuevas estén disponibles.

### Duración de la vinculación: 30 días

**La vinculación de cada extensión con el funcionario dura 30 días corridos desde el momento en que se utiliza el código y se emite el token.** No son 30 días desde la última conexión.

- **Código de vinculación:** dura **5 minutos**, se usa una sola vez.
- **Token de extensión:** dura **30 días** desde su emisión; no se renueva automáticamente.
- **Uso habitual de la extensión:** abrirla, iniciar sesión en plataformas o reportar su versión **no prolonga** esos 30 días.
- **Actualización de versión:** actualizar Chrome/Edge o la extensión **no reinicia** el plazo del token si se conserva la vinculación.
- **Al vencer:** la extensión deja de acceder a las credenciales hasta que se vincule nuevamente con un código nuevo generado por el administrador.
- **Revocación anticipada:** el administrador puede invalidar la vinculación antes de que se cumplan los 30 días.

> **Estado actual:** no existe renovación automática de tokens. La fecha de última conexión que aparece en el panel de administración es informativa y no modifica el vencimiento.

### Vincular un funcionario

1. El administrador entra al portal y, en **Vincular extensión de un funcionario**, selecciona al funcionario activo.
2. Pulsa **Generar código para funcionario** y entrega el código de manera privada.
3. El funcionario abre la extensión, introduce el código y pulsa **Vincular**.
4. El código dura **5 minutos**, es de **un solo uso** y la vinculación dura **30 días** desde su creación.
5. Una vez vinculada, la extensión conserva el token en el almacenamiento local del navegador, incluso después de cerrarlo.

El administrador puede usar **Revocar vinculación del funcionario** para invalidar los tokens y códigos pendientes de esa cuenta. La extensión no ofrece un botón de desvinculación al funcionario. La revocación no elimina los accesos asignados.

> La aplicación web todavía conserva una opción para que el funcionario genere su propio código; no debe confundirse con la revocación administrativa. Para imponer vinculación exclusivamente por administrador habría que deshabilitar también ese endpoint.

### Abrir plataformas y completar credenciales

- **Abrir [plataforma]:** abre el enlace correspondiente en una pestaña nueva.
- **Completar credenciales:** aparece cuando la pestaña activa corresponde a un dominio autorizado para un acceso asignado. Rellena los campos compatibles de usuario y contraseña; **no envía el formulario automáticamente**.
- Si el sitio utiliza un formulario especial, iframe o cambia el dominio, el autocompletado puede requerir ajustes específicos.

**CRM y dominios reconocidos (v1.3.3):**

| Plataforma | URL del botón «Abrir» | Dominios autorizados para autocompletar |
| --- | --- | --- |
| CRM VENTURY | `https://venturyfx.tradingcrm.com/` | `venturyfx.tradingcrm.com` y `adfs365.stg-tradingcrm.com` |
| CRM MERCADOS | `https://mercadosinvest.tradingcrm.com/` | `mercadosinvest.tradingcrm.com` y `adfs365.stg-tradingcrm.com` |
| Otras plataformas | URL registrada para el funcionario | Dominio de la URL registrada |

**Importante:** VENTURY y MERCADOS pueden compartir el dominio `adfs365.stg-tradingcrm.com`. En ese caso se muestran botones separados para cada acceso asignado. Elegí el CRM correcto antes de completar los campos. La extensión valida el dominio, el acceso y la pertenencia al funcionario desde el servidor.

La URL utilizada por el botón **Abrir** no modifica la URL ni las credenciales almacenadas en PostgreSQL.

## Requisitos y ejecución local

- Node.js **20+** y npm.
- PostgreSQL accesible desde el servidor.
- Variables de entorno de [`.env.example`](.env.example).

```bash
npm install
cp .env.example .env
openssl rand -hex 32  # APP_ENCRYPTION_KEY
openssl rand -hex 32  # SESSION_SECRET (distinto)
npm start
```

Configurar en `.env`:

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión PostgreSQL |
| `APP_ENCRYPTION_KEY` | Clave AES-256-GCM, **64 caracteres hexadecimales** |
| `SESSION_SECRET` | Secreto aleatorio para firmar hashes de sesión/tokens |
| `ADMIN_EMAIL` | Correo del administrador inicial |
| `ADMIN_PASSWORD` | Contraseña inicial de al menos **12 caracteres** |
| `NODE_ENV` | `production` en producción |
| `PORT` | Puerto local; predeterminado `3000` |
| `DATABASE_SSL` | `true` cuando la conexión exige TLS con certificado verificable |

El arranque crea, si no existen, las tablas `employees`, `accesses`, `sessions`, `extension_pair_codes` y `extension_tokens`. En `extension_tokens` agrega, si faltan, las columnas `version` y `last_seen` para el seguimiento de versiones. El administrador inicial se crea si no existe una cuenta con `ADMIN_EMAIL`.

**No subir el archivo `.env` ni las credenciales de las plataformas al repositorio.**

## Despliegue en Vercel

1. Conectar el repositorio a Vercel y configurar las variables de entorno del proyecto.
2. Verificar que PostgreSQL sea accesible desde el entorno de ejecución.
3. Publicar los cambios del backend y comprobar `GET /api/health` (respuesta esperada: `status: ok` y `database: connected`).
4. Instalar o recargar la extensión localmente. **Los cambios de GitHub no actualizan por sí solos una extensión descomprimida.**

La extensión actual utiliza `https://accesoslansel.vercel.app` como API. Si se cambia el dominio de despliegue, hay que actualizar la URL de API y los permisos de host de la extensión.

## Seguridad y limitaciones

- Contraseñas del portal: **bcrypt**.
- Contraseñas de plataformas: **AES-256-GCM** en la base de datos.
- Sesiones web: cookies `HttpOnly`, `SameSite=Strict`, con expiración de **12 horas**.
- Tokens de extensión: almacenados como hash en PostgreSQL, con vencimiento de **30 días** y revocación por administrador.
- Códigos de vinculación: **5 minutos** y un solo uso.
- El servidor verifica el funcionario propietario del acceso antes de devolver las credenciales.
- Los secretos devueltos para autocompletar deben permanecer fuera de logs, capturas y mensajes compartidos.
- **Conservar una copia segura de `APP_ENCRYPTION_KEY`**: si se pierde, no podrán descifrarse las contraseñas ya guardadas.
- Pendiente para endurecimiento de producción: límites de intentos de inicio de sesión, auditoría, rotación de claves y revisión de permisos.

## Seguimiento de versiones de la extensión

1. El funcionario debe tener una vinculación vigente y utilizar la **extensión v1.3.3 o posterior**.
2. Al abrir la extensión, esta valida la vinculación mediante `GET /api/extension/me` e informa su versión en la cabecera `X-LANSEL-Extension-Version`.
3. El servidor registra la versión y la hora en el token correspondiente, sin registrar contraseñas ni códigos de vinculación en ese reporte.
4. El administrador abre **Extensiones → Versiones instaladas** y pulsa **Actualizar listado**. Los datos se obtienen de `GET /api/admin/extensions`, protegido por sesión y rol administrador.
5. **Sin vinculación vigente** indica que no hay token vigente; **Vinculado · sin reporte** indica que existe un token pero no se recibió una versión; **Sin actividad reciente** indica que el último reporte tiene más de siete días. La fecha de conexión representa el último reporte de la extensión, **no presencia en línea continua**.

Si un funcionario aparece sin versión, verificar que la extensión instalada sea v1.3.3 o posterior, que el servidor esté desplegado y que se haya abierto la extensión. La extensión v1.3.2 informa la versión mediante un endpoint separado y puede no aparecer correctamente en algunos despliegues. No revocar el token por un error de telemetría.

## Solución de problemas

| Síntoma | Qué revisar |
| --- | --- |
| No aparece **Completar credenciales** | Estar en la pestaña correcta, usar la versión reciente y verificar el dominio y el nombre del acceso asignado |
| El botón aparece pero no rellena | Revisar si el formulario usa iframe, campos no estándar o redirecciones; comprobar que el servidor esté actualizado |
| **Vinculación vencida** | Confirmar que el token esté realmente vencido o revocado; solo entonces pedir al administrador un código nuevo |
| Funcionario vinculado pero no aparece su versión | Comprobar v1.3.3 o posterior, abrir la extensión, esperar el despliegue de Vercel y actualizar el listado del administrador |
| No aparecen plataformas | Confirmar que el administrador haya asignado accesos a ese funcionario |
| Error 401 / 403 | Sesión o token vencido/revocado, usuario inactivo o dominio no autorizado |
| Error 503 | Revisar variables de entorno, conexión PostgreSQL y `/api/health` |

## Estado

Este README describe las funciones implementadas en el repositorio y la extensión **v1.3.3**. La disponibilidad en producción depende del despliegue de Vercel y de la actualización local de cada extensión. La compatibilidad efectiva con cada formulario CRM debe validarse en un navegador real después del despliegue.

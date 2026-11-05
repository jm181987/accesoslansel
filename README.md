# Accesos LANSEL

Portal corporativo para administrar los accesos de los funcionarios a plataformas de trabajo. Incluye una aplicación web con roles de **administrador** y **funcionario**, y la extensión **LANSEL Access** para Chrome y Edge.

- **Aplicación:** https://accesoslansel.vercel.app/
- **Extensión:** carpeta [`extension/`](extension/)
- **Versión de la extensión:** **1.2.5** (consultar [`extension/manifest.json`](extension/manifest.json) para la versión vigente).

## Funcionalidades

| Funcionario | Administrador |
| --- | --- |
| Iniciar sesión y consultar únicamente sus accesos | Crear funcionarios y activar/desactivar cuentas |
| Abrir las plataformas asignadas | Asignar accesos con URL, usuario y contraseña |
| Consultar/copiar sus credenciales desde el portal | Editar y eliminar accesos existentes |
| Vincular la extensión y completar credenciales en sitios compatibles | Generar códigos de vinculación por funcionario y revocar vinculaciones |

La aplicación separa los accesos por `employee_id` en el servidor; la extensión solo consulta los accesos del funcionario asociado a su token.

## Extensión Chrome / Edge

### Instalar o actualizar

1. Descargar el repositorio desde **Code → Download ZIP** y descomprimirlo.
2. Abrir `chrome://extensions` (Chrome) o `edge://extensions` (Edge).
3. Activar **Modo desarrollador**.
4. Seleccionar **Cargar descomprimida** y elegir la carpeta `extension/`.
5. Si ya está instalada desde una carpeta local, actualizar los archivos de **esa misma carpeta** y pulsar **Recargar**. Si se instala desde una carpeta distinta como extensión nueva, habrá que vincularla de nuevo.

> La extensión no se actualiza automáticamente desde GitHub. La versión del servidor también debe estar desplegada en Vercel para que las funciones nuevas estén disponibles.

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

**CRM y dominios reconocidos (v1.2.5):**

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

El arranque crea, si no existen, las tablas `employees`, `accesses`, `sessions`, `extension_pair_codes` y `extension_tokens`. El administrador inicial se crea si no existe una cuenta con `ADMIN_EMAIL`.

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

## Solución de problemas

| Síntoma | Qué revisar |
| --- | --- |
| No aparece **Completar credenciales** | Estar en la pestaña correcta, usar la versión reciente y verificar el dominio y el nombre del acceso asignado |
| El botón aparece pero no rellena | Revisar si el formulario usa iframe, campos no estándar o redirecciones; comprobar que el servidor esté actualizado |
| **Vinculación vencida** | Pedir al administrador un código nuevo y volver a vincular |
| No aparecen plataformas | Confirmar que el administrador haya asignado accesos a ese funcionario |
| Error 401 / 403 | Sesión o token vencido/revocado, usuario inactivo o dominio no autorizado |
| Error 503 | Revisar variables de entorno, conexión PostgreSQL y `/api/health` |

## Estado

Este README describe el código del repositorio y la extensión **v1.2.5**. La compatibilidad efectiva con cada formulario CRM debe validarse en un navegador real después del despliegue.

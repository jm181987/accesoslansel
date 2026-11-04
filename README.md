# Accesos LANSEL

Sistema de credenciales privadas por funcionario, con administrador que crea cuentas y asigna enlaces, usuarios y contraseñas.

## Instalación

1. Node.js 20+, `npm install`.
2. Copiar `.env.example` a `.env` y configurar la conexión PostgreSQL en el servidor, sin publicar secretos.
3. Generar `APP_ENCRYPTION_KEY` y `SESSION_SECRET` con `openssl rand -hex 32` (cada una distinta).
4. Configurar `ADMIN_EMAIL` y `ADMIN_PASSWORD` (mínimo 12 caracteres).
5. `npm start`. El sistema crea tablas `employees`, `accesses`, `sessions` automáticamente e inicializa el administrador si aún no existe.
6. Publicar tras HTTPS, por ejemplo con Coolify como aplicación Node.js, puerto 3000.

## Seguridad

La contraseña de inicio de sesión se guarda como hash bcrypt; las credenciales de plataformas se cifran con AES-256-GCM. La autorización por propietario se valida en el backend. Las claves de entorno no se suben al repositorio. Mantener copia segura de `APP_ENCRYPTION_KEY`: perderla impide descifrar las contraseñas existentes. Rotar la contraseña de base de datos compartida en el chat antes del despliegue. Para producción se recomienda añadir limitación de intentos de inicio de sesión, auditoría y HTTPS/TLS a PostgreSQL.

## Alcance inicial

Administrador: crear funcionarios, activarlos/desactivarlos y asignar credenciales. Funcionario: ver solo sus propios accesos, abrir URL y copiar usuario o contraseña. La primera versión no incluye edición ni eliminación de accesos, recuperación de contraseña ni despliegue automatizado.

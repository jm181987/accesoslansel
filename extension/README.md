# LANSEL Access — Chrome y Edge

## Instalación
1. Descargá el repositorio de GitHub como ZIP y descomprimilo.
2. En Chrome abrí chrome://extensions o en Edge edge://extensions.
3. Activá Modo desarrollador.
4. Elegí Cargar descomprimida y seleccioná la carpeta extension.
5. Fijá la extensión en la barra del navegador.

## Vincular
1. Iniciá sesión en https://accesoslansel.vercel.app/.
2. En Extensión Chrome / Edge generá un código temporal.
3. Pegalo en la extensión y pulsá Vincular.
4. Abrí una plataforma HTTPS que tengas asignada.
5. En la extensión pulsá Completar [plataforma]. Revisá y enviá manualmente.

## Alcance y seguridad
El token se guarda temporalmente en chrome.storage.session y caduca en 12 horas. El código de vinculación es de un solo uso y dura 5 minutos. No se almacenan contraseñas en la extensión ni se envían formularios automáticamente. El dominio debe coincidir exactamente con el registrado en LANSEL. Los formularios en iframes, de múltiples pasos o con componentes personalizados podrían requerir ajustes por plataforma. Un usuario o script malicioso en la página puede leer credenciales rellenadas; no es equivalente a SSO. Para revocar el acceso de inmediato desactivá el usuario; el token dejará de ser válido.

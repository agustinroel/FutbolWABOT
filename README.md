# Bot de fútbol de Montemar

Bot local de WhatsApp para gestionar la convocatoria del partido semanal de los jueves en Montemar (Alicante). Usa Drizzle ORM sobre SQLite local, `whatsapp-web.js` con sesión `LocalAuth` y tareas programadas sin servicios de pago ni infraestructura cloud.

> **Importante:** `whatsapp-web.js` automatiza WhatsApp Web y no es una API oficial de WhatsApp. WhatsApp puede rechazar la vinculación o limitar una cuenta. No existe un ajuste de código que garantice el emparejamiento si WhatsApp bloquea el cliente; no intentes evadir un bloqueo.

## Requisitos e instalación

- Node.js 20 o posterior y npm.
- Chromium/Puppeteer compatible con el sistema. En Windows y equipos de escritorio suele instalarse con Puppeteer; en VPS Linux pueden ser necesarias las bibliotecas indicadas más abajo.

```bash
npm install
Copy-Item .env.example .env
```

Edita `.env` antes de arrancar:

| Variable | Uso |
| --- | --- |
| `MONTEMAR_GROUP_ID` | JID del grupo autorizado (`...@g.us`). Mientras esté vacío, el bot imprime los IDs de grupos detectados y no responde a mensajes. |
| `ADMIN_PHONE_NUMBERS` | Números internacionales separados por coma, por ejemplo `34600112233,34600999888`. También acepta JID `@c.us`. |
| `TIMEZONE` | Zona horaria IANA para cron, por defecto `Europe/Madrid`. |
| `DATABASE_PATH` | Archivo SQLite local, por defecto `./data/montemar.sqlite`. |
| `PUPPETEER_EXECUTABLE_PATH` | Ruta opcional a Chrome/Chromium ya instalado; si no se configura, se detectan ubicaciones habituales del sistema. |
| `MATCH_CAPACITY` | Plazas, normalmente `10` o `14`; por defecto `14`. |
| `MATCH_TIME` | Hora local del partido `HH:MM`; por defecto `20:00`. |
| `PITCH_LOCATION` | Ubicación mostrada en avisos; por defecto `Cancha Montemar, Alicante`. |
| `FEE_PER_PLAYER` | Importe fijo opcional en euros. Tiene prioridad sobre `PITCH_COST`. |
| `PITCH_COST` | Coste total de pista opcional; cuando se configura, se divide entre los convocados actuales. |
| `DASHBOARD_API_HOST` / `DASHBOARD_API_PORT` | Bind local del endpoint de solo lectura para el panel. En local usa `127.0.0.1:8787`; en Docker se configura el bind interno `0.0.0.0`. |
| `DASHBOARD_API_TOKEN` | Token secreto que protege el API del bot. Si está vacío, el endpoint no arranca. Usa una cadena aleatoria larga y no la compartas. |

Inicia el bot con `npm run dev` durante el desarrollo o `npm run build` seguido de `npm start` para producción. En el primer inicio, escanea el QR del terminal desde WhatsApp → **Dispositivos vinculados** → **Vincular un dispositivo**. La sesión se conserva localmente en `.wwebjs_auth/`.

Si npm avisa que bloqueó scripts de instalación, autoriza solo los paquetes necesarios y vuelve a instalar:

```bash
npm install-scripts approve better-sqlite3 esbuild puppeteer
npm install
```

Si Puppeteer no puede descargar su Chromium (por ejemplo, una caché de navegador incompleta), se intentará usar Chrome/Chromium ya instalado en ubicaciones habituales. También puedes instalarlo con `npx puppeteer browsers install chrome` o indicar otra ruta en `PUPPETEER_EXECUTABLE_PATH`.

### Si el QR no permite vincular el dispositivo

1. Comprueba que usas el WhatsApp oficial actualizado en el teléfono y escanea desde **Dispositivos vinculados → Vincular un dispositivo**.
2. Asegúrate de que hay un dispositivo vinculado disponible y utiliza únicamente el QR vigente que muestra el proceso activo.
3. Comprueba que la fecha y hora del equipo y del teléfono están configuradas automáticamente; cierra instancias duplicadas del bot.
4. Revisa en la consola las líneas `Estado de WhatsApp` y `WhatsApp se desconectó`. Un estado `TOS_BLOCK` o `SMB_TOS_BLOCK` significa que WhatsApp ha bloqueado esta modalidad: el programa no repetirá la conexión automáticamente; usa los canales oficiales de WhatsApp y no intentes eludir el bloqueo.
5. Si no hay bloqueo explícito, detén el bot, espera un poco y prueba una sola vez con un QR nuevo. Si continúa el rechazo, puede ser una restricción de cuenta o plataforma que el código no puede resolver.

Añade el bot al grupo y copia el ID que aparece en la consola a `MONTEMAR_GROUP_ID`; reinicia el proceso después de cambiar `.env`. El bot ignora chats privados y cualquier grupo distinto al configurado. Los comandos enviados desde el mismo número vinculado también se procesan; usa `/lista` en el grupo para verificar la conexión.

## Comandos

En el grupo, escribe `/ayuda` para ver la lista correspondiente a tu rol. Los comandos con `@jugador` esperan una mención real de WhatsApp.

### Para todos los jugadores

| Comando | Acción |
| --- | --- |
| `/voy` o `+1` | Apuntarse. Reacciona 👍 si entra en convocados o ⏳ si queda en suplentes. |
| `/mebajo` o `-1` | Darse de baja (reacción ❌). Si libera plaza, se avisa y menciona al suplente promocionado. |
| `/lista` | Ver fecha, estado de la convocatoria, plazas confirmadas y suplentes por orden. |
| `/jugadores` o `/plantilla` | Ver los perfiles de todos los jugadores registrados y sus partidos, asistencia y balance V/E/D. |
| `/historial [1-20]` | Ver número total de partidos jugados, balance de resultados, goles, asistencias y los últimos resultados (por defecto, 5). |
| `/perfil GK 7.5` | Actualizar tu perfil. Posiciones: `GK`, `DEF`, `MID`, `FWD`; nivel: `1`–`10`. |
| `/pague` | Avisar con una reacción 👀; queda pendiente de confirmación administrativa. También se reconocen capturas con pie de foto que indique Bizum/pago. |
| `/stats` | Ver tus partidos, asistencia, balance de victorias/empates/derrotas y rating. |
| `/stats @jugador` | Consultar las estadísticas de otro jugador. |
| `/mvp @jugador` | Votar al MVP durante las 2 horas posteriores al registro del resultado. El voto se puede cambiar. |
| `/ayuda` | Ver los comandos disponibles para tu rol. |
| `/id` | Consultar el identificador del grupo actual. |

### Solo administradores

| Comando | Acción |
| --- | --- |
| `/convocar @jugador` | Añadir manualmente a un jugador a convocados o suplentes; se usa el nombre de su perfil de WhatsApp. Repetir el comando actualiza el nombre de un jugador ya apuntado. |
| `/retirar @jugador` | Retirar a un jugador; si libera plaza, promociona al primer suplente. |
| `/armar_equipos` | Crear equipos equilibrados por posición y nivel; guarda la composición para el resultado. |
| `/pagado @jugador` | Confirmar el pago del jugador mencionado; la respuesta muestra su nombre de perfil. |
| `/deudores` | Publicar los nombres de los convocados con pago pendiente o por confirmar. |
| `/reset_pagos` | Marcar como pendientes todos los pagos del partido activo. |
| `/cerrar` | Cerrar la convocatoria y bloquear nuevas altas/bajas. |
| `/abrir_convocatoria` | Abrir o reabrir el jueves que corresponda: antes de la hora del partido de este jueves conserva esta fecha; después, elige el siguiente jueves. |
| `/cancelar_convocatoria CONFIRMAR` | Cancelar el partido activo y borrar su lista y pagos. Si se reabre antes de la fecha, conserva ese jueves; si ya pasó, abre el siguiente. |
| `/resultado 3-2` | Registrar los goles de Equipo A y B, actualizar ratings y abrir la votación MVP. |
| `/no_show @jugador` | Marcar como no presentado a un jugador del último partido registrado. |
| `/nuevo_partido` | Alias administrativo de `/abrir_convocatoria`. Selecciona el próximo jueves según la fecha actual; no requiere que ya se haya registrado un resultado. |
| `/borrar_partido AAAA-MM-DD CONFIRMAR` | (Admin) Borrar únicamente la convocatoria de esa fecha y sus datos asociados. Para descartar un partido de prueba, por ejemplo `/borrar_partido 2026-10-08 CONFIRMAR`. Si tenía resultado, restaura los ratings previos. No permite borrarlo si hay cambios de rating posteriores para los mismos jugadores. |
| `/registrar_jugador 34600112233 GK 7.5 Nombre Apellido` | Registrar o actualizar un jugador, su teléfono, posición y nivel. Teléfono con prefijo internacional, sin `+`. |

## Panel privado de estadísticas (Vercel)

El panel Next.js está en `apps/web`. Por seguridad y sencillez operativa, Vercel *no* abre ni monta el SQLite local y tampoco recibe credenciales de base de datos: el daemon del bot ofrece un API HTTP de solo lectura protegido con `DASHBOARD_API_TOKEN`, y las rutas servidoras de Next.js lo consultan desde Vercel. El navegador nunca recibe ese token. El API no publica JID/números telefónicos (usa identificadores opacos); los datos personales, la plantilla y el estado de pagos del grupo requieren la contraseña del panel.

Para desarrollo local, instala también sus dependencias con `npm install --prefix apps/web`; Vercel las instala desde el `package-lock.json` de `apps/web` al desplegar esa carpeta como Root Directory.

### Despliegue recomendado

1. Publica el daemon en un VPS estable con Docker Compose o PM2. Configura `DASHBOARD_API_TOKEN` como un secreto aleatorio fuerte y fija `DASHBOARD_API_HOST=127.0.0.1` si un proxy TLS inverso corre en el mismo host. En Docker, Compose configura el bind interno y publica el puerto únicamente en loopback del host.
2. Expón `/api/dashboard` mediante HTTPS (por ejemplo, un proxy TLS en el VPS) y limita ese proxy a las rutas del API; `/health` es una comprobación sin datos privados. No publiques el puerto HTTP sin TLS directamente en Internet. Comprueba desde el servidor que `https://TU_HOST/api/dashboard` responde `401` sin token.
3. Importa el repositorio en Vercel y selecciona `apps/web` como **Root Directory** (framework Next.js). Añade estos secretos/valores en Vercel:

   | Variable Vercel | Valor |
   | --- | --- |
   | `BOT_API_URL` | URL base HTTPS del proxy del bot, sin `/api/dashboard`. |
   | `BOT_API_TOKEN` | El mismo valor configurado como `DASHBOARD_API_TOKEN` en el VPS. |
   | `DASHBOARD_ACCESS_PASSWORD` | Contraseña fuerte y exclusiva para el acceso privado del panel. |

4. Activa también **Vercel Deployment Protection** para preview/producción. La contraseña del panel no reemplaza la protección de despliegue. El panel incluye clasificación, perfiles, convocados, suplentes, estados de pago y los 20 resultados recientes; actualiza automáticamente cada 60 segundos. Si no hay partido o resultados, muestra un estado vacío real.
5. En local, deja `BOT_API_URL` apuntando al API del bot y configura `DASHBOARD_ACCESS_PASSWORD`, `BOT_API_URL` y `BOT_API_TOKEN` en el entorno del proceso web (nunca en un archivo versionado). En PowerShell:

   ```powershell
   $env:DASHBOARD_ACCESS_PASSWORD = "contraseña-local-fuerte"
   $env:BOT_API_URL = "https://tu-host-del-bot"
   $env:BOT_API_TOKEN = "el-mismo-secreto-del-vps"
   npm run dev:web
   ```

   La web compila con `npm run build:web` y comprueba tipos con `npm run typecheck:web`. La detección de comprobantes usa el pie de foto de la imagen; no descarga imágenes ni hace OCR.

La separación API/Vercel mantiene SQLite en el único proceso que escribe, evita bloqueos en un entorno serverless y evita duplicar la base de datos en una base gestionada. Si más adelante se requiere failover multi-región o múltiples instancias del bot, habrá que migrar explícitamente las operaciones síncronas actuales de SQLite a un backend remoto transaccional (libSQL/Turso o PostgreSQL); no basta con cambiar la URL del ORM.

## Producción del daemon

### Docker Compose

Instala Docker Engine y el plugin Compose en un VPS, completa `.env` (incluido `DASHBOARD_API_TOKEN`) y ejecuta:

```bash
docker compose up -d --build
docker compose logs -f bot
```

La primera vez, vincula WhatsApp escaneando el QR desde el terminal/log. SQLite, sesión y caché del navegador se conservan en volúmenes Docker. Haz copia de seguridad periódica del volumen de datos y de la sesión; protege esta última como credencial. Chromium y sus dependencias se incluyen en la imagen. El contenedor es de un solo proceso, reinicia automáticamente y no publica el API fuera de `127.0.0.1`.

### PM2 en un VPS Linux

Con Node.js 20+ y Chromium instalados, copia `.env` con permisos restringidos y configura `PUPPETEER_EXECUTABLE_PATH`. Ejecuta `sh scripts/pm2-start.sh`: compila, instala/configura `pm2-logrotate`, arranca el proceso y guarda el estado de PM2. Configura `pm2 startup` según las instrucciones del propio PM2 para habilitar el arranque después de reiniciar el servidor.

## Flujo de ramas y versiones

El repositorio sigue este flujo:

- `main`: versiones desplegables; etiqueta cada entrega con una versión semántica (`vMAJOR.MINOR.PATCH`).
- `develop`: integración de funcionalidades finalizadas.
- `feature/<tema>` / `fix/<tema>`: ramas de trabajo; abre un Pull Request hacia `develop`.
- Cuando `develop` está validada, abre un Pull Request hacia `main`, integra y crea la etiqueta semántica correspondiente.

Ejemplo de comandos para preparar ramas desde este directorio (se ejecutan manualmente con Git instalado; no se hacen commits ni merges automáticos):

```bash
git init -b main
git add .
git commit -m "chore: bootstrap Montemar football bot"
git switch -c develop
git switch -c feature/ux-improvements-and-vercel-dashboard
# configura el remoto origin antes de hacer push
git push -u origin develop
git push -u origin feature/ux-improvements-and-vercel-dashboard
# abre y aprueba PR feature/ux-improvements-and-vercel-dashboard -> develop
# una vez fusionado en el servidor:
git switch develop
git pull --ff-only
# Para cada cambio nuevo, crea una feature/* o fix/* desde develop,
# súbela y repite el flujo de PR anterior.
# abre y aprueba PR develop -> main; tras fusionarlo en el servidor:
git switch main
git pull --ff-only
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin main --follow-tags
```

La etiqueta del ejemplo es ilustrativa: usa el siguiente número que corresponda a los cambios reales y no reutilices etiquetas.

Los números de teléfono de `/registrar_jugador` deben llevar prefijo de país, sin `+`. Al inscribirse por primera vez, un jugador no precargado se registra con posición `MID` y rating `5.0`; podrá completar su perfil con `/perfil`. También puedes cargar o actualizar perfiles antes del primer partido:

```bash
npm exec tsx src/database/seed.ts 34600112233 "Nombre Apellido" GK 7.5
```

No introduzcas números ni datos de jugadores reales en el repositorio. La base local y las sesiones de WhatsApp están excluidas de Git.

## Automatización, base de datos y comprobaciones

- Cada martes a las 10:00 (zona horaria configurada) se abre la convocatoria del jueves y se publica fecha, hora, ubicación y plazas.
- Cada jueves a las 10:00 se publica un recordatorio con el número de convocados.
- `npm run db:migrate` aplica el esquema idempotente; `npm run db:push` es un alias. Las definiciones tipadas de Drizzle están en `src/database/tables.ts`; las migraciones SQL están en `src/database/schema.ts`.
- `npm test`, `npm run build`, `npm run build:all`, `npm run typecheck:web` y `npm run lint` ejecutan pruebas, compilación del bot, compilación bot+web, comprobación de tipos web y lint, respectivamente.

La base SQLite se crea automáticamente al iniciar. Para migraciones locales se versiona el esquema SQL en `src/database/schema.ts`.

### Servidor Linux

Si Chromium no arranca en un servidor Ubuntu/Debian, instala sus bibliotecas del sistema (puede variar por versión de distribución):

```bash
sudo apt-get update
sudo apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2
```

Usa una cuenta de WhatsApp dedicada si es posible, conserva `.wwebjs_auth/` entre reinicios y protege el acceso al archivo de base de datos y la sesión.

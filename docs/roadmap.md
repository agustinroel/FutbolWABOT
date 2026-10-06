# Roadmap del proyecto Montemar

Estado del proyecto al **6 de octubre de 2026**. Este documento recoge la evolución desde el bot inicial hasta el dashboard local, y separa lo terminado de las tareas en curso y futuras.

## Leyenda

- [x] Terminado y comprobado.
- [~] En curso o pendiente de completar/verificar.
- [ ] Pendiente.

## 1. Bot de WhatsApp y gestión de partidos

### Base técnica

- [x] Crear el proyecto Node.js con TypeScript estricto, npm, ESLint y Prettier.
- [x] Implementar persistencia local con SQLite, Drizzle ORM y migraciones.
- [x] Añadir configuración por variables de entorno, archivo de ejemplo y exclusiones de secretos, sesiones, bases de datos y artefactos de compilación en `.gitignore`.
- [x] Implementar cliente `whatsapp-web.js`, autenticación persistente `LocalAuth`, lectura del QR en terminal y filtrado al grupo configurado.
- [x] Configurar el grupo de Montemar y administradores en el entorno local sin versionar sus datos privados.
- [x] Registrar y resolver correctamente los mensajes y menciones de WhatsApp, incluidos los comandos enviados desde la cuenta vinculada.

### Convocatoria y asistencia

- [x] Abrir y consultar convocatorias mediante `/voy`, `+1`, `/mebajo`, `-1` y `/lista`.
- [x] Limitar el cupo, mantener suplentes en orden de inscripción y promover automáticamente al primero de la lista cuando queda una plaza libre.
- [x] Añadir gestión administrativa de altas y bajas manuales.
- [x] Implementar cierre, apertura, cancelación y reapertura de convocatorias.
- [x] Calcular el jueves aplicable usando la fecha, hora del partido y zona horaria configurada; evitar publicar convocatorias canceladas o ya jugadas.
- [x] Añadir pruebas para cupos, cola, promociones, cancelaciones, reaperturas y fechas.
- [~] Revisar con el administrador que la convocatoria y hora que aparecen en la base local corresponden al próximo partido real. No borrar ni alterar registros hasta confirmar cuáles fueron partidos de prueba.

### Pagos, perfiles, resultados y estadísticas

- [x] Registrar avisos de pago y confirmar pagos como administrador; listar deudores y reiniciar estados de pago.
- [x] Mostrar nombres legibles de perfil en respuestas, pagos, menciones y listados en lugar de identificadores técnicos.
- [x] Añadir perfiles con posición y nivel, y registro/actualización administrativa de jugadores.
- [x] Calcular partidos, asistencia, ausencias, bajas tardías y balance de victorias/empates/derrotas.
- [x] Registrar resultados, equipos, historial y MVP; actualizar ratings y permitir marcar inasistencias.
- [x] Añadir comandos de ayuda, perfiles, historial, estadísticas y eliminación controlada de un partido de prueba con restauración de rating cuando es segura.
- [x] Implementar división determinista de equipos que equilibra rating y posiciones, con pruebas.
- [x] Programar anuncios de convocatoria y recordatorios de los jueves.

### Experiencia de WhatsApp

- [x] Reducir mensajes del grupo mediante reacciones a las altas, bajas y avisos de pago.
- [x] Anunciar por texto la promoción de un suplente.
- [x] Reconocer imágenes cuyo pie de foto indica intención de pago, crear un pago pendiente y avisar al grupo; la detección no descarga imágenes ni realiza OCR.
- [x] Mejorar formato de mensajes y mantener los comandos de consulta explícita como respuestas de texto.

## 2. Panel web de estadísticas

- [x] Crear un dashboard Next.js privado, adaptado a móvil y con sistema visual documentado en `design-system/MASTER.md`.
- [x] Incluir convocatoria en vivo, cuenta regresiva, titulares, suplentes, pagos, filtros y orden del ranking, perfiles y detalle de partidos/MVP.
- [x] Añadir estados de carga, error y vacío, y controles accesibles para móvil.
- [x] Proteger el acceso mediante contraseña y cookie de sesión `HttpOnly`.
- [x] Crear una API de solo lectura protegida con token; ocultar JID y teléfonos usando identificadores opacos y no exponer el token al navegador.
- [x] Elegir una API del daemon como puente entre el SQLite local y el dashboard: Vercel no monta el archivo SQLite ni necesita sus credenciales.
- [x] Verificar el dashboard local con datos reales de la base y confirmar acceso, carga de jugadores e historial.
- [x] Corregir la hora mostrada en el campo para que coincida con la convocatoria configurada, en vez de fijarla a las 20:00.
- [x] Añadir un proceso API de solo lectura independiente (`npm run dev:dashboard-api`) para desarrollo local, con puerto configurable y acceso a la misma SQLite; se puede reiniciar sin iniciar una segunda sesión de WhatsApp.
- [x] Configurar la web local para consumir ese API separado y mantener sus secretos en archivos excluidos de Git.
- [x] Arrancar el bot local con `DASHBOARD_API_ENABLED=false`; recuperó la sesión guardada, se autenticó en WhatsApp y mostró el cliente listo y las automatizaciones activas. El proceso sigue siendo local y no sobrevive al apagado del PC.
- [~] Confirmar la fecha y hora reales: la SQLite local muestra el **8 de octubre de 2026** como `PLAYED` y una convocatoria `OPEN` para el **15 de octubre de 2026**. No se modificó ni eliminó ningún registro; confirmar si el día 8 fue prueba antes de corregir la base.
- [ ] Decidir si el panel debe mostrar también movimientos de rating por semana; el indicador actual muestra el último cambio registrado, no una serie histórica semanal.

## 3. Operación, despliegue y repositorio

- [x] Añadir `Dockerfile` multi-stage, `docker-compose.yml`, `.dockerignore` y configuración de PM2 para ejecución persistente.
- [x] Añadir Caddy opcional con HTTPS automático; el proxy público permite solo `/api/dashboard` y `/health`, y el API del bot conserva autenticación Bearer.
- [x] Añadir un workflow de GitHub Actions para tests, lint, tipos y builds en pushes/PRs a las ramas de integración.
- [x] Documentar variables de entorno, operación, seguridad, Vercel, Compose/Caddy y flujo de ramas en `README.md`.
- [x] Inicializar el repositorio Git y crear las ramas `main`, `develop` y `feature/ux-improvements-and-vercel-dashboard`.
- [x] Crear el commit inicial de bootstrap y dejar activa la rama de feature solicitada.
- [x] Validar el código con 31 pruebas pasando, lint, TypeScript web, builds de bot+web y auditoría web sin vulnerabilidades; parsear YAML de Compose/CI. La auditoría de producción del bot sigue reportando 9 vulnerabilidades altas y el YAML aún necesita validación real con Docker.
- [~] Mantener `http://localhost:3000` como preview mientras los procesos locales estén activos; la contraseña del preview está en `apps/web/.env.local`, excluido de Git.
- [ ] Validar Docker Compose/Caddy y construir/arrancar las imágenes en un equipo con Docker.
- [ ] Validar PM2 y las instrucciones de reinicio automático en un servidor con PM2.
- [ ] Desplegar el daemon en un VPS y conservar de forma segura la base SQLite, la sesión de WhatsApp y sus copias de seguridad.
- [ ] Probar desde fuera del VPS HTTPS, rechazo de solicitudes no autenticadas, salud y disponibilidad del endpoint.
- [ ] Desplegar `apps/web` en Vercel, configurar sus secretos del lado servidor y activar Deployment Protection.
- [ ] Confirmar en GitHub Actions que el workflow nuevo termina correctamente en la rama remota.
- [ ] Completar la integración del feature mediante Pull Request a `develop`; tras pruebas de integración, fusionar a `main` y crear una etiqueta semántica de release.
- [ ] Revisar y decidir cómo corregir las **9 vulnerabilidades altas** que `npm audit --omit=dev` reporta en `basic-ftp` y `extract-zip`, transitivas de `puppeteer@24.38.0` que fija `whatsapp-web.js@1.34.7`. No forzar el downgrade sugerido por npm sin comprobar WhatsApp en una cuenta de prueba. La auditoría de la web no presentó vulnerabilidades.

## 4. Configuración que requiere el propietario

- [x] Configurar localmente el JID del grupo y los administradores.
- [x] Vincular una sesión de WhatsApp en el equipo local.
- [x] Crear credenciales locales aleatorias para el dashboard y su API; están guardadas en archivos ignorados por Git y no deben copiarse al repositorio ni compartirse.
- [ ] Confirmar los valores operativos definitivos: hora del partido, aforo y cuota fija o coste de cancha.
- [ ] Crear/contratar y facilitar acceso al VPS, un dominio/subdominio DNS y el proyecto/cuenta Vercel para el despliegue. No enviar contraseñas ni credenciales por el chat.
- [ ] Crear secretos de producción fuertes: `DASHBOARD_API_TOKEN` en el VPS y el mismo valor en `BOT_API_TOKEN` de Vercel; usar un `DASHBOARD_ACCESS_PASSWORD` distinto para el panel.
- [ ] Confirmar la convocatoria activa antes de eliminar o corregir datos de pruebas.

## 5. Riesgos y decisiones pendientes

- [ ] Aceptar que `whatsapp-web.js` automatiza WhatsApp Web y no es la API oficial; una vinculación puede dejar de funcionar por cambios o restricciones de WhatsApp. No existe un ajuste que garantice disponibilidad.
- [ ] Decidir si la arquitectura seguirá con una única instancia SQLite/API en VPS o si se requiere alta disponibilidad/múltiples instancias. Para esto último habrá que migrar explícitamente las operaciones actuales de SQLite a una base remota transaccional (por ejemplo, libSQL/Turso o PostgreSQL); cambiar una URL no basta.
- [ ] Definir política y periodicidad de copias de seguridad, retención y recuperación de la base, sesión y registros.
- [ ] Revisar qué información personal y de pagos debe ver cada usuario del dashboard; actualmente el panel completo está protegido por una contraseña compartida.

## 6. Pasos manuales finales para dejar bot y frontend 24/7

Estos pasos requieren cuentas, servidores, DNS y una sesión de WhatsApp que solo el propietario puede autorizar. El ordenador personal podrá apagarse una vez completados y verificados.

1. **Confirmar datos del partido y conservar el historial.** Revisar en el panel que el 8 de octubre de 2026 figura `PLAYED` y el próximo partido está en el 15 de octubre. Confirmar si el día 8 fue real o una prueba. Si fue prueba, decidir si se elimina con `/borrar_partido 2026-10-08 CONFIRMAR` antes de mover la base; no ejecutar ese comando hasta confirmar. Confirmar asimismo la hora, aforo y precio.
2. **Preparar el proveedor persistente.** Crear un VPS Linux en una región europea (recomendado como mínimo 2 vCPU y 4 GB RAM para Chromium/WhatsApp) y un nombre DNS, por ejemplo `api.tu-dominio.com`, con registro A apuntando a la IP del VPS. Abrir en el firewall SSH y TCP 80/443; mantener 8787 cerrado al público. Un servidor siempre encendido normalmente tiene coste; Vercel puede alojar gratis la web, pero no sustituye al VPS persistente del bot.
3. **Subir el código a GitHub.** Revisar y subir la rama feature; configurar el remoto si todavía no existe. El workflow `.github/workflows/ci.yml` debe quedar verde. Importar ese mismo repositorio desde Vercel cuando el cambio esté disponible en GitHub.
4. **Configurar el VPS.** Instalar Docker Engine y Compose, clonar el repositorio y crear `.env` a partir de `.env.example`. Rellenar `MONTEMAR_GROUP_ID`, `ADMIN_PHONE_NUMBERS`, `TIMEZONE=Europe/Madrid`, `MATCH_TIME`, `MATCH_CAPACITY`, `PITCH_LOCATION`, la cuota/coste, `DASHBOARD_API_DOMAIN=api.tu-dominio.com` y un `DASHBOARD_API_TOKEN` generado en el propio VPS (por ejemplo, `openssl rand -hex 32`). No copiar `.env` a GitHub.
5. **Trasladar los datos y arrancar una sola instancia.** Hacer un respaldo de la SQLite local y decidir si se importa al VPS para conservar jugadores e historial. Detener el bot del ordenador antes de iniciar el remoto; no ejecutar dos procesos con la misma cuenta de WhatsApp/sesión. Arrancar con `docker compose config` y después `docker compose --profile public-api up -d --build`.
6. **Autorizar WhatsApp en el VPS.** Consultar `docker compose logs -f bot`; si aparece un QR, vincularlo con el teléfono propietario. Esperar el mensaje de cliente listo. La sesión quedará almacenada en el volumen Docker y el contenedor reiniciará automáticamente.
7. **Verificar la API segura.** Comprobar que `https://api.tu-dominio.com/health` devuelve estado OK, que `/api/dashboard` sin token devuelve `401` y que el panel con autenticación obtiene datos con el token correcto. No publicar el puerto interno HTTP 8787.
8. **Publicar el frontend en Vercel.** Importar GitHub, configurar Root Directory `apps/web`, framework Next.js y estas variables de servidor: `BOT_API_URL=https://api.tu-dominio.com`, `BOT_API_TOKEN` con el mismo secreto que `DASHBOARD_API_TOKEN` del VPS y `DASHBOARD_ACCESS_PASSWORD` con una contraseña privada distinta. Activar Deployment Protection y desplegar.
9. **Validar el sistema apagando el PC.** Abrir el dominio Vercel desde el móvil, iniciar sesión y comprobar convocatoria, datos y pagos; verificar que bot, recordatorios y API siguen disponibles desde el VPS. Luego apagar el PC y repetir las comprobaciones.
10. **Operación continua.** Programar copias cifradas de los volúmenes SQLite y sesión, probar su recuperación, revisar actualizaciones de imagen/logs y renovar o rotar secretos si se exponen. La copia de la sesión WhatsApp debe tratarse como una credencial.

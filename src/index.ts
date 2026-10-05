import { config } from './config/env.js';
import { handleMessage } from './handlers/commands.js';
import { startScheduler } from './modules/scheduler/index.js';
import { createWhatsAppClient } from './modules/whatsapp/client.js';
import { getMessageChatId } from './modules/whatsapp/messageContext.js';
import { startDashboardApi } from './modules/dashboard/api.js';

const client = createWhatsAppClient();
const dashboardApi = startDashboardApi();
let schedulerStarted = false;
const reportedMismatchedGroups = new Set<string>();

client.on('ready', () => {
  console.info('Cliente listo. Escuchando mensajes de grupo y comandos.');
  if (schedulerStarted) return;
  schedulerStarted = true;
  startScheduler(client);
});
client.on('message_create', (message) => {
  const chatId = getMessageChatId(message);
  if (!chatId.endsWith('@g.us')) return;

  const command = message.body.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? '';
  const isCommand = command.startsWith('/') || command === '+1' || command === '-1';
  console.info(`[WhatsApp] Mensaje de grupo detectado (fromMe=${message.fromMe}, comando=${isCommand ? command : 'no'}).`);

  if (config.groupId && chatId !== config.groupId && !reportedMismatchedGroups.has(chatId)) {
    reportedMismatchedGroups.add(chatId);
    console.warn(`[WhatsApp] Mensaje recibido en un grupo no configurado: ${chatId}. MONTEMAR_GROUP_ID actual: ${config.groupId}.`);
  } else if (config.groupId && chatId === config.groupId && isCommand) {
    console.info(`[WhatsApp] Procesando ${command} en el grupo configurado.`);
  }

  void handleMessage(client, message).catch((error: unknown) => {
    console.error('Error no controlado al procesar mensaje:', error);
  });
});

if (!config.groupId) {
  console.warn('MONTEMAR_GROUP_ID está vacío. El bot mostrará por consola los IDs de grupos detectados y no responderá en ellos.');
} else {
  console.info(`Grupo configurado: ${config.groupId}`);
}
if (config.adminIds.size === 0) {
  console.warn('ADMIN_PHONE_NUMBERS está vacío. Los comandos administrativos estarán bloqueados.');
}

void client.initialize().catch((error: unknown) => {
  console.error('No se pudo iniciar el cliente de WhatsApp:', error);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    dashboardApi?.close();
    void client.destroy().finally(() => process.exit(0));
  });
}

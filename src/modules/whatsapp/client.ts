import qrcode from 'qrcode-terminal';
import { existsSync } from 'node:fs';
import path from 'node:path';
import whatsappWeb from 'whatsapp-web.js';
import type { Client as WhatsAppClient } from 'whatsapp-web.js';
import { config } from '../../config/env.js';

const { Client, LocalAuth } = whatsappWeb;
const nonRetryableStates = new Set(['TOS_BLOCK', 'SMB_TOS_BLOCK', 'DEPRECATED_VERSION']);

function findInstalledBrowser(): string | undefined {
  if (config.puppeteerExecutablePath) return config.puppeteerExecutablePath;

  const candidates = process.platform === 'win32'
    ? [
        path.join(process.env.PROGRAMFILES ?? 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
      ]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome-stable'];
  return candidates.find((candidate) => existsSync(candidate));
}

export function createWhatsAppClient(): WhatsAppClient {
  let reconnectTimer: NodeJS.Timeout | undefined;
  const executablePath = findInstalledBrowser();
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    },
    takeoverOnConflict: true
  });

  const scheduleReconnect = (): void => {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void client.initialize().catch((error: unknown) => {
        console.error('No se pudo reconectar a WhatsApp:', error);
        scheduleReconnect();
      });
    }, 5_000);
  };

  client.on('qr', (qr: string) => {
    console.info('Escanea este QR desde WhatsApp > Dispositivos vinculados:');
    qrcode.generate(qr, { small: true });
  });
  client.on('authenticated', () => console.info('Sesión de WhatsApp autenticada.'));
  client.on('auth_failure', (message: string) => console.error('Falló la autenticación de WhatsApp:', message));
  client.on('change_state', (state) => {
    console.info(`Estado de WhatsApp: ${state}`);
  });
  client.on('ready', () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    console.info('WhatsApp conectado y listo.');
    void client.getWWebVersion()
      .then((version) => console.info(`Versión de WhatsApp Web: ${version}`))
      .catch((error: unknown) => console.warn('No se pudo consultar la versión de WhatsApp Web:', error));
  });
  client.on('disconnected', (reason: string) => {
    console.error('WhatsApp se desconectó:', reason);
    if (nonRetryableStates.has(reason)) {
      console.error('No se reintentará la conexión: WhatsApp informó un bloqueo o una versión obsoleta. No vuelvas a escanear hasta resolverlo desde los canales oficiales.');
      return;
    }
    scheduleReconnect();
  });

  return client;
}

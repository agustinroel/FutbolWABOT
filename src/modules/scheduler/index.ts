import cron from 'node-cron';
import { config } from '../../config/env.js';
import { ensureUpcomingMatch, getDateInTimezone, getRoster, isMatchCancelled, nextThursdayDate } from '../matches/service.js';
import { formatCard } from '../../utils/whatsapp-format.js';
import type { Client } from 'whatsapp-web.js';

function formatMatchAnnouncement(date: string, capacity: number): string {
  const formattedDate = new Intl.DateTimeFormat('es-ES', {
    timeZone: config.timezone, weekday: 'long', day: 'numeric', month: 'long'
  }).format(new Date(`${date}T12:00:00Z`));
  return formatCard('CONVOCATORIA ABIERTA · MONTEMAR', [
    `📅 *Jueves ${formattedDate}*`,
    `🕗 ${config.matchTime}`,
    `📍 ${config.location}`,
    `👥 *${capacity} plazas*`,
    '',
    '┌ *¿Vienes a jugar?*',
    '│ `/voy` o `+1`  ·  Apuntarme',
    '│ `/mebajo` o `-1`  ·  Darme de baja',
    '└ `/lista`  ·  Ver convocatoria'
  ]);
}

async function announce(client: Client, date?: string): Promise<void> {
  if (!config.groupId) {
    console.warn('No se envió la convocatoria: configura MONTEMAR_GROUP_ID en .env.');
    return;
  }
  const matchDate = date ?? nextThursdayDate();
  if (isMatchCancelled(matchDate)) {
    console.info(`No se publica la convocatoria del ${matchDate}: fue cancelada por un administrador.`);
    return;
  }
  const match = ensureUpcomingMatch(matchDate);
  await client.sendMessage(config.groupId, formatMatchAnnouncement(match.match_date, match.capacity));
}

export function startScheduler(client: Client): void {
  cron.schedule('0 10 * * 2', () => {
    void announce(client).catch((error: unknown) => console.error('Error enviando la convocatoria semanal:', error));
  }, { timezone: config.timezone });

  cron.schedule('0 10 * * 4', async () => {
    if (!config.groupId) return;
    try {
      const date = getDateInTimezone(new Date(), config.timezone);
      if (isMatchCancelled(date)) {
        console.info(`No se envía el recordatorio del ${date}: la convocatoria fue cancelada.`);
        return;
      }
      const match = ensureUpcomingMatch(date);
      if (match.status === 'PLAYED') {
        console.info(`No se envía el recordatorio del ${date}: el resultado ya está registrado.`);
        return;
      }
      const roster = getRoster(match.id);
      const confirmed = roster.filter((player) => player.status === 'CONFIRMED').length;
      const waitlist = roster.filter((player) => player.status === 'WAITLIST').length;
      await client.sendMessage(config.groupId,
        formatCard('HOY HAY FÚTBOL · MONTEMAR', [
          `🕗 *${config.matchTime}*`,
          `📍 ${config.location}`,
          `👥 Convocados: *${confirmed}/${match.capacity}* · Suplentes: *${waitlist}*`,
          '',
          'Consulta la lista con `/lista` o avisa de tu baja con `/mebajo`.'
        ]));
    } catch (error) {
      console.error('Error enviando el recordatorio del jueves:', error);
    }
  }, { timezone: config.timezone });

  console.info(`Automatización semanal activa (${config.timezone}): convocatoria martes 10:00, recordatorio jueves 10:00.`);
}

export { announce };

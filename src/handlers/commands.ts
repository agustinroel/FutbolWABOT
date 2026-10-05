import type { Client, Message } from 'whatsapp-web.js';
import { config } from '../config/env.js';
import { db } from '../database/client.js';
import { balanceTeams } from '../modules/balancing/balancer.js';
import { cancelUpcomingMatch, closeMatch, deleteMatchByDate, dropPlayer, ensurePlayer, findPlayerByIds, getActiveMatch, getRoster, openUpcomingMatch, registerPlayer, setPlayerProfile, updatePlayerName, type Match, type Player } from '../modules/matches/service.js';
import { confirmPayment, getPlayerFee, isPaymentProofIntent, listDebtors, reportPayment, resetPayments } from '../modules/payments/service.js';
import { castMvpVote, getAllPlayerStats, getLatestMvpMatch, getLatestPlayedMatch, getMatchHistory, getPlayerStats, markNoShow, recordResult } from '../modules/stats/service.js';
import { getMessageChatId, getMessageSenderId } from '../modules/whatsapp/messageContext.js';
import { formatCard, formatHelp, formatMatchHistory, formatPlayerDirectory, formatRoster as renderRoster } from '../utils/whatsapp-format.js';

const reportedGroupIds = new Set<string>();

function normalizeId(id: string): string {
  return id.replace(/:\d+@/, '@');
}

function isAdmin(senderId: string): boolean {
  return config.adminIds.has(normalizeId(senderId));
}

function mention(id: string): string {
  return `@${id.split('@')[0]}`;
}

async function react(message: Message, emoji: string): Promise<void> {
  try {
    await message.react(emoji);
  } catch (error) {
    console.warn(`No se pudo reaccionar al mensaje ${message.id._serialized} con ${emoji}:`, error);
  }
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: config.timezone,
    day: 'numeric',
    month: 'long'
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatRoster(match: Match): string {
  const roster = getRoster(match.id);
  const confirmed = roster.filter((player) => player.status === 'CONFIRMED');
  const waitlist = roster.filter((player) => player.status === 'WAITLIST');
  return renderRoster(confirmed, waitlist, match.capacity, formatDate(match.match_date), match.status);
}

function targetPlayer(message: Message): string | undefined {
  return message.mentionedIds.map(normalizeId)[0] ?? message.body.match(/(?:^|\s)(\d{7,15})(?:\s|$)/)?.[1]?.concat('@c.us');
}

async function resolveMentionedPlayer(client: Client, rawId: string, createIfMissing = false): Promise<Player> {
  const mentionedId = normalizeId(rawId);
  const mappings = await client.getContactLidAndPhone([mentionedId]);
  const mapping = mappings[0];
  const candidateIds = [...new Set([
    mentionedId,
    ...(mapping?.lid ? [normalizeId(mapping.lid)] : []),
    ...(mapping?.pn ? [normalizeId(mapping.pn)] : [])
  ])];
  const existing = findPlayerByIds(candidateIds);
  if (existing) return existing;
  if (!createIfMissing) throw new Error('El jugador mencionado no está registrado. Primero debe apuntarse con /voy.');

  const contactId = mapping?.lid ?? mentionedId;
  const contact = await client.getContactById(contactId);
  const name = contact.pushname?.trim() || contact.name?.trim() || contact.shortName?.trim();
  if (!name) {
    throw new Error('No pude obtener el nombre del contacto. Regístralo con /registrar_jugador.');
  }
  const playerId = mapping?.pn ?? mapping?.lid ?? mentionedId;
  const player = ensurePlayer(normalizeId(playerId), name);
  updatePlayerName(player.id, name);
  return { ...player, name };
}

async function sendToGroup(client: Client, text: string, mentionIds: string[] = []): Promise<void> {
  if (!config.groupId) return;
  const chat = await client.getChatById(config.groupId);
  await chat.sendMessage(text, { mentions: mentionIds });
}

function formatTeams(matchId: number): string {
  const players = getRoster(matchId)
    .filter((player) => player.status === 'CONFIRMED')
    .map((player) => ({ id: player.id, name: player.name, position: player.position, rating: player.rating }));
  const teams = balanceTeams(players);
  db.transaction(() => {
    const clear = db.prepare('UPDATE roster SET team = NULL WHERE match_id = ?');
    clear.run(matchId);
    const assign = db.prepare('UPDATE roster SET team = ? WHERE match_id = ? AND player_id = ?');
    for (const player of teams.teamA) assign.run('A', matchId, player.id);
    for (const player of teams.teamB) assign.run('B', matchId, player.id);
  })();
  const print = (team: typeof teams.teamA): string => team
    .map((player) => `• ${player.name} (${player.position}, ${player.rating.toFixed(1)})`)
    .join('\n');
  return formatCard('EQUIPOS MONTEMAR', [
    `*🔵 Peto / chaleco* · media ${teams.averageA.toFixed(2)}`,
    print(teams.teamA),
    '',
    `*⚪ Sin peto* · media ${teams.averageB.toFixed(2)}`,
    print(teams.teamB),
    '',
    `Diferencia de nivel: ${teams.ratingDelta.toFixed(2)}`
  ]);
}

export async function handleMessage(client: Client, message: Message): Promise<void> {
  const chatId = getMessageChatId(message);
  if (chatId.endsWith('@g.us') && !config.groupId && !reportedGroupIds.has(chatId)) {
    reportedGroupIds.add(chatId);
    console.info(`Grupo detectado: ${chatId}. Copia este ID a MONTEMAR_GROUP_ID en .env.`);
  }
  if (!config.groupId || chatId !== config.groupId) return;

  const body = message.body.trim();
  const normalized = body.toLowerCase();
  const senderId = normalizeId(getMessageSenderId(message, client.info.wid._serialized));
  const paymentProofIntent = isPaymentProofIntent(message.type, body);
  if (paymentProofIntent) {
    try {
      const sender = await resolveMentionedPlayer(client, senderId);
      const match = getActiveMatch();
      if (match.status !== 'OPEN') {
        throw new Error('No hay una convocatoria abierta para asociar el comprobante.');
      }
      const paymentStatus = reportPayment(match, sender.id);
      if (paymentStatus === 'PAID') {
        await react(message, '✅');
        await message.reply(formatCard('COMPROBANTE RECIBIDO', [`*${sender.name}* ya figura como pagado; no se modificó su estado.`]));
      } else {
        await react(message, '👀');
        await sendToGroup(client,
          `👀 Comprobante de ${mention(sender.id)} recibido. Pendiente de verificación administrativa.`,
          [sender.id]);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error inesperado al registrar el comprobante.';
      console.error(`No se pudo registrar comprobante de ${senderId}:`, error);
      await react(message, '⚠️');
      await message.reply(formatCard('COMPROBANTE NO REGISTRADO', [detail]));
    }
    return;
  }
  if (!normalized.startsWith('/') && normalized !== '+1' && normalized !== '-1') return;

  try {
    const contact = await client.getContactById(senderId);
    const senderName = contact.pushname || contact.name || senderId.split('@')[0] || 'Jugador';
    const sender = ensurePlayer(senderId, senderName);
    const match = getActiveMatch();
    const args = body.split(/\s+/).slice(1);
    const command = normalized.split(/\s+/)[0];
    if (match.status === 'CANCELLED' &&
        !['/abrir_convocatoria', '/ayuda', '/id', '/lista', '/borrar_partido'].includes(command ?? '')) {
      throw new Error(`La convocatoria del ${formatDate(match.match_date)} está cancelada. Un administrador puede usar /abrir_convocatoria para reabrirla.`);
    }

    switch (command) {
      case '/voy':
      case '+1': {
        if (match.status !== 'OPEN') throw new Error('La convocatoria está cerrada.');
        const registration = registerPlayer(match, sender);
        await react(message, registration.status === 'CONFIRMED' ? '👍' : '⏳');
        return;
      }
      case '/mebajo':
      case '-1': {
        const result = dropPlayer(match, senderId);
        if (!result.removed) throw new Error('No apareces en la convocatoria de este partido.');
        const promotion = result.promoted ? `\n🎉 ${mention(result.promoted.id)} sube de suplente a convocado.` : '';
        await react(message, '❌');
        if (result.promoted) {
          await sendToGroup(client,
            `↩️ ${sender.name} se ha dado de baja.${promotion}\n🎉 *${result.promoted.name}* ha sido promocionado.`,
            [result.promoted.id]);
        }
        return;
      }
      case '/convocar': {
        if (!isAdmin(senderId)) throw new Error('Comando reservado a administradores.');
        const rawPlayerId = targetPlayer(message);
        if (!rawPlayerId) throw new Error('Uso: /convocar @jugador (menciona al jugador).');
        const player = await resolveMentionedPlayer(client, rawPlayerId, true);
        const registration = registerPlayer(match, player);
        await message.reply(formatCard('CONVOCATORIA ACTUALIZADA', [
          `*${player.name}* añadido a ${registration.status === 'CONFIRMED' ? 'convocados' : 'la lista de espera'}.`,
          '',
          formatRoster(match)
        ]));
        return;
      }
      case '/retirar': {
        if (!isAdmin(senderId)) throw new Error('Comando reservado a administradores.');
        const rawPlayerId = targetPlayer(message);
        if (!rawPlayerId) throw new Error('Uso: /retirar @jugador (menciona al jugador).');
        const player = await resolveMentionedPlayer(client, rawPlayerId);
        const result = dropPlayer(match, player.id);
        if (!result.removed) throw new Error('Ese jugador no figura en la convocatoria.');
        const promotion = result.promoted ? `\n🎉 ${mention(result.promoted.id)} sube de suplente a convocado.` : '';
        await sendToGroup(client, `Admin ha retirado a *${player.name}*.${promotion}`,
          result.promoted ? [result.promoted.id] : []);
        await message.reply(formatCard('CONVOCATORIA ACTUALIZADA', [
          `Jugador retirado.${result.promoted ? ` *${result.promoted.name}* ha sido promocionado.` : ''}`,
          '',
          formatRoster(match)
        ]));
        return;
      }
      case '/lista':
        await message.reply(formatRoster(match));
        return;
      case '/perfil': {
        if (args.length !== 2) throw new Error('Uso: /perfil <GK|DEF|MID|FWD> <rating 1-10>.');
        const position = args[0]?.toUpperCase();
        if (!position || !['GK', 'DEF', 'MID', 'FWD'].includes(position)) throw new Error('La posición debe ser GK, DEF, MID o FWD.');
        setPlayerProfile(senderId, position as 'GK' | 'DEF' | 'MID' | 'FWD', Number(args[1]));
        await message.reply(formatCard('PERFIL ACTUALIZADO', [
          `Posición: *${position}*`,
          `Nivel: *${Number(args[1]).toFixed(1)}/10*`
        ]));
        return;
      }
      case '/pague':
        reportPayment(match, senderId);
        await react(message, '👀');
        return;
      case '/pagado': {
        if (!isAdmin(senderId)) throw new Error('Comando reservado a administradores.');
        const rawPlayerId = targetPlayer(message);
        if (!rawPlayerId) throw new Error('Uso: /pagado @jugador (menciona al jugador).');
        const player = await resolveMentionedPlayer(client, rawPlayerId);
        confirmPayment(match, player.id);
        await message.reply(formatCard('PAGO CONFIRMADO', [`✅ *${player.name}* ya figura como pagado.`]));
        return;
      }
      case '/deudores': {
        if (!isAdmin(senderId)) throw new Error('Comando reservado a administradores.');
        const debtors = listDebtors(match.id);
        if (!debtors.length) {
          await message.reply(formatCard('PAGOS AL DÍA', ['No hay pagos pendientes entre los convocados.']));
          return;
        }
        const fee = getPlayerFee(getRoster(match.id).filter((player) => player.status === 'CONFIRMED').length);
        const amount = fee === undefined ? '' : ` (${fee.toFixed(2)} €)`;
        await message.reply(formatCard(`PAGOS PENDIENTES${amount}`, debtors.map((player, index) =>
          `${String(index + 1).padStart(2, '0')}  *${player.name}*`
        )));
        return;
      }
      case '/reset_pagos':
        if (!isAdmin(senderId)) throw new Error('Comando reservado a administradores.');
        await message.reply(formatCard('PAGOS REINICIADOS', [
          `Se han restablecido *${resetPayments(match.id)}* pago(s).`
        ]));
        return;
      case '/armar_equipos':
        if (!isAdmin(senderId)) throw new Error('Comando reservado a administradores.');
        await message.reply(formatTeams(match.id));
        return;
      case '/cerrar':
        if (!isAdmin(senderId)) throw new Error('Comando reservado a administradores.');
        closeMatch(match.id);
        await message.reply(formatCard('CONVOCATORIA CERRADA', ['Ya no se aceptan nuevas inscripciones.']));
        return;
      case '/abrir_convocatoria': {
        if (!isAdmin(senderId)) throw new Error('Comando reservado a administradores.');
        if (args.length) throw new Error('Uso: /abrir_convocatoria (abre el jueves que corresponda según la fecha y hora actuales).');
        const opened = openUpcomingMatch();
        await message.reply(formatCard('CONVOCATORIA ABIERTA', [
          `📅 Jueves ${formatDate(opened.match_date)}`,
          `🕗 ${config.matchTime} · 📍 ${opened.location}`,
          'El alta está habilitada. Usa `/lista` para consultar las plazas.',
          '',
          formatRoster(opened)
        ]));
        return;
      }
      case '/cancelar_convocatoria': {
        if (!isAdmin(senderId)) throw new Error('Comando reservado a administradores.');
        if (args.length !== 1 || args[0]?.toUpperCase() !== 'CONFIRMAR') {
          throw new Error('Uso: /cancelar_convocatoria CONFIRMAR. Se borrarán la lista de jugadores y pagos de esta convocatoria.');
        }
        const cancelled = cancelUpcomingMatch(match.id);
        await message.reply(formatCard('CONVOCATORIA CANCELADA', [
          `⛔ Jueves ${formatDate(cancelled.match_date)}.`,
          'Se eliminaron las inscripciones y registros asociados.',
          'Antes de esa fecha, `/abrir_convocatoria` vuelve a abrir este jueves; después, abrirá el siguiente jueves.'
        ]));
        return;
      }
      case '/registrar_jugador': {
        if (!isAdmin(senderId)) throw new Error('Comando reservado a administradores.');
        const [phone, position, rawRating, ...nameParts] = args;
        const name = nameParts.join(' ');
        if (!phone || !name || !position || !rawRating) {
          throw new Error('Uso: /registrar_jugador <teléfono> <GK|DEF|MID|FWD> <rating 1-10> <nombre>.');
        }
        const id = phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@c.us`;
        const player = ensurePlayer(id, name);
        setPlayerProfile(player.id, position.toUpperCase() as 'GK' | 'DEF' | 'MID' | 'FWD', Number(rawRating));
        await message.reply(formatCard('JUGADOR REGISTRADO', [
          `*${name}*`,
          `Posición: *${position.toUpperCase()}* · Nivel: *${Number(rawRating).toFixed(1)}/10*`
        ]));
        return;
      }
      case '/resultado': {
        if (!isAdmin(senderId)) throw new Error('Comando reservado a administradores.');
        const result = args[0]?.match(/^(\d+)-(\d+)$/);
        if (!result) throw new Error('Uso: /resultado <goles-equipoA>-<goles-equipoB>, por ejemplo /resultado 3-2.');
        recordResult(match, Number(result[1]), Number(result[2]));
        await message.reply(formatCard('RESULTADO REGISTRADO', [
          `🔵 Equipo A  *${result[1]} — ${result[2]}*  Equipo B ⚪`,
          '',
          'Estadísticas e historial de ratings actualizados.',
          '⭐ Votación MVP abierta durante 2 horas: `/mvp @jugador`.'
        ]));
        return;
      }
      case '/no_show': {
        if (!isAdmin(senderId)) throw new Error('Comando reservado a administradores.');
        const rawPlayerId = targetPlayer(message);
        if (!rawPlayerId) throw new Error('Uso: /no_show @jugador (menciona al jugador).');
        const player = await resolveMentionedPlayer(client, rawPlayerId);
        const playedMatch = getLatestPlayedMatch();
        if (!playedMatch) throw new Error('Todavía no hay un resultado registrado para corregir.');
        markNoShow(playedMatch.id, player.id);
        await message.reply(formatCard('ASISTENCIA ACTUALIZADA', [
          `*${player.name}* marcado como no presentado.`
        ]));
        return;
      }
      case '/stats': {
        const playerId = targetPlayer(message) ?? senderId;
        const stats = getPlayerStats(normalizeId(playerId));
        if (!stats) throw new Error('No se encontró el perfil. Apúntate con /voy para registrarte.');
        await message.reply(formatCard(`ESTADÍSTICAS · ${stats.name.toUpperCase()}`, [
          `⚽ Partidos: *${stats.matches}*`,
          `📈 Asistencia: *${stats.attendanceRate.toFixed(0)}%* · ${stats.attended} jugados`,
          `🏆 Victorias: *${stats.wins}* · Empates: *${stats.draws}* · Derrotas: *${stats.losses}*`,
          `⏰ Bajas tardías: *${stats.lateCancellations}* · Ausencias: *${stats.noShows}*`,
          `⭐ Nivel: *${stats.rating.toFixed(2)}/10*`
        ]));
        return;
      }
      case '/jugadores':
      case '/plantilla': {
        const pages = formatPlayerDirectory(getAllPlayerStats());
        await message.reply(pages[0] ?? formatCard('DIRECTORIO DE JUGADORES', ['No hay resultados.']));
        for (const page of pages.slice(1)) await sendToGroup(client, page);
        return;
      }
      case '/historial': {
        const limit = args[0] === undefined ? 5 : Number(args[0]);
        if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
          throw new Error('Uso: /historial [1-20]. Por defecto muestra los últimos 5 partidos.');
        }
        await message.reply(formatMatchHistory(getMatchHistory(limit), config.timezone));
        return;
      }
      case '/mvp': {
        const rawPlayerId = targetPlayer(message);
        if (!rawPlayerId) throw new Error('Uso: /mvp @jugador (menciona al candidato).');
        const mvpMatch = getLatestMvpMatch();
        if (!mvpMatch) throw new Error('No hay una votación MVP abierta en este momento.');
        const candidate = await resolveMentionedPlayer(client, rawPlayerId);
        castMvpVote(mvpMatch, senderId, candidate.id);
        await message.reply(formatCard('VOTO MVP REGISTRADO', [
          `⭐ Tu voto es para *${candidate.name}*.`
        ]));
        return;
      }
      case '/nuevo_partido': {
        if (!isAdmin(senderId)) throw new Error('Comando reservado a administradores.');
        const nextMatch = openUpcomingMatch();
        await message.reply(formatCard('SIGUIENTE CONVOCATORIA LISTA', [
          `📅 Jueves ${formatDate(nextMatch.match_date)}`,
          `🕗 ${config.matchTime} · 📍 ${nextMatch.location}`,
          'Se eligió la fecha siguiente disponible según el calendario actual.',
          '',
          formatRoster(nextMatch)
        ]));
        return;
      }
      case '/borrar_partido': {
        if (!isAdmin(senderId)) throw new Error('Comando reservado a administradores.');
        if (args.length !== 2 || args[1] !== 'CONFIRMAR') {
          throw new Error('Uso: /borrar_partido AAAA-MM-DD CONFIRMAR. Elimina esa fecha y todos sus datos de convocatoria y resultado.');
        }
        const deleted = deleteMatchByDate(args[0] ?? '');
        if (!deleted) throw new Error(`No existe ningún partido registrado para ${args[0]}.`);
        await message.reply(formatCard('PARTIDO ELIMINADO', [
          `Se eliminó la convocatoria del *${formatDate(deleted.match_date)}* y sus datos de asistencia, pagos, votación MVP y resultado.`,
          deleted.status === 'PLAYED' ? 'Se restauraron los ratings previos a ese partido.' : '',
          'La fecha vuelve a estar disponible para una nueva convocatoria.'
        ].filter(Boolean)));
        return;
      }
      case '/id':
        await message.reply(formatCard('ID DEL GRUPO', [`\`${getMessageChatId(message)}\``]));
        return;
      case '/ayuda':
        await message.reply(formatHelp(isAdmin(senderId)));
        return;
      default:
        return;
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error inesperado al procesar el comando.';
    console.error(`Error procesando comando de ${senderId}:`, error);
    await message.reply(formatCard('NO SE PUDO COMPLETAR', [
      `⚠️ ${detail}`,
      '',
      'Escribe `/ayuda` para consultar los comandos disponibles.'
    ]));
  }
}

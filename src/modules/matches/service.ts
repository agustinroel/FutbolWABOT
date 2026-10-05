import { db } from '../../database/client.js';
import { orm } from '../../database/client.js';
import { players, roster as rosterTable } from '../../database/tables.js';
import { config } from '../../config/env.js';
import { and, eq } from 'drizzle-orm';
import { addToQueue, removeFromQueue, sortQueueEntries, type QueueResult } from './queue.js';

export interface Match {
  id: number;
  match_date: string;
  capacity: number;
  location: string;
  starts_at: string;
  status: 'OPEN' | 'CLOSED' | 'PLAYED' | 'CANCELLED';
  score_a: number | null;
  score_b: number | null;
}

export interface Player {
  id: string;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  rating: number;
}

interface RosterRow extends Player {
  status: 'CONFIRMED' | 'WAITLIST';
  joined_at: string;
}

export function getDateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function zonedDateTimeToUtc(date: string, time: string, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const desiredUtc = Date.UTC(year ?? 2000, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0);
  const initial = new Date(desiredUtc);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(initial);
  const values = new Map(parts.map((part) => [part.type, Number(part.value)]));
  const renderedUtc = Date.UTC(
    values.get('year') ?? 2000, (values.get('month') ?? 1) - 1, values.get('day') ?? 1,
    values.get('hour') ?? 0, values.get('minute') ?? 0
  );
  return new Date(desiredUtc + desiredUtc - renderedUtc);
}

export function nextThursdayDate(date = new Date(), timezone = config.timezone): string {
  const [year, month, day] = getDateInTimezone(date, timezone).split('-').map(Number);
  const localDateUtc = new Date(Date.UTC(year ?? 2000, (month ?? 1) - 1, day ?? 1));
  const daysUntilThursday = (4 - localDateUtc.getUTCDay() + 7) % 7 || 7;
  localDateUtc.setUTCDate(localDateUtc.getUTCDate() + daysUntilThursday);
  return localDateUtc.toISOString().slice(0, 10);
}

export function getUpcomingMatchDate(
  now = new Date(),
  timezone = config.timezone,
  matchTime = config.matchTime
): string {
  const today = getDateInTimezone(now, timezone);
  const [year, month, day] = today.split('-').map(Number);
  const weekday = new Date(Date.UTC(year ?? 2000, (month ?? 1) - 1, day ?? 1)).getUTCDay();
  const daysUntilThursday = (4 - weekday + 7) % 7;
  let candidate = addDaysToDate(today, daysUntilThursday);
  if (daysUntilThursday === 0 &&
      zonedDateTimeToUtc(candidate, matchTime, timezone).getTime() <= now.getTime()) {
    candidate = addDaysToDate(candidate, 7);
  }
  return candidate;
}

export function isMatchCancelled(date: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM cancelled_matches WHERE match_date = ?').get(date));
}

export function ensureUpcomingMatch(date = nextThursdayDate()): Match {
  if (isMatchCancelled(date)) {
    throw new Error(`La convocatoria del ${date} está cancelada. Un administrador puede reabrirla con /abrir_convocatoria.`);
  }
  db.prepare(`
    INSERT INTO matches (match_date, capacity, location, starts_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(match_date) DO NOTHING
  `).run(date, config.matchCapacity, config.location, `${date}T${config.matchTime}`);
  const match = db.prepare('SELECT * FROM matches WHERE match_date = ?').get(date) as Match | undefined;
  if (!match) throw new Error(`No se pudo cargar el partido del ${date}.`);
  return match;
}

export function getActiveMatch(now = new Date()): Match {
  const today = getDateInTimezone(now, config.timezone);
  const [year, month, day] = today.split('-').map(Number);
  const isThursday = new Date(Date.UTC(year ?? 2000, (month ?? 1) - 1, day ?? 1)).getUTCDay() === 4;
  const todayMatch = isThursday
    ? db.prepare('SELECT * FROM matches WHERE match_date = ?').get(today) as Match | undefined
    : undefined;
  let candidateDate = todayMatch && todayMatch.status !== 'PLAYED'
    ? today
    : getUpcomingMatchDate(now);

  for (let attempt = 0; attempt < 52; attempt += 1) {
    const existing = db.prepare('SELECT * FROM matches WHERE match_date = ?')
      .get(candidateDate) as Match | undefined;
    if (existing?.status === 'PLAYED') {
      candidateDate = addDaysToDate(candidateDate, 7);
      continue;
    }
    if (isMatchCancelled(candidateDate)) {
      if (!existing) throw new Error(`Falta el registro de la convocatoria cancelada del ${candidateDate}.`);
      return { ...existing, status: 'CANCELLED' };
    }
    return ensureUpcomingMatch(candidateDate);
  }
  throw new Error('No se encontró una fecha disponible para el siguiente partido.');
}

function addDaysToDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year ?? 2000, (month ?? 1) - 1, (day ?? 1) + days));
  return next.toISOString().slice(0, 10);
}

export function ensureNextMatchAfter(match: Match): Match {
  let candidateDate = addDaysToDate(match.match_date, 7);
  for (let attempt = 0; attempt < 52; attempt += 1) {
    const existing = db.prepare('SELECT status FROM matches WHERE match_date = ?')
      .get(candidateDate) as { status: Match['status'] } | undefined;
    if (!existing || existing.status === 'OPEN') return ensureUpcomingMatch(candidateDate);
    candidateDate = addDaysToDate(candidateDate, 7);
  }
  throw new Error('No se encontró una fecha disponible para crear la siguiente convocatoria.');
}

export function openUpcomingMatch(now = new Date()): Match {
  let candidateDate = getUpcomingMatchDate(now);
  for (let attempt = 0; attempt < 52; attempt += 1) {
    const existing = db.prepare('SELECT * FROM matches WHERE match_date = ?')
      .get(candidateDate) as Match | undefined;
    if (existing?.status === 'PLAYED') {
      candidateDate = addDaysToDate(candidateDate, 7);
      continue;
    }

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM cancelled_matches WHERE match_date = ?').run(candidateDate);
      if (existing) {
        db.prepare("UPDATE matches SET status = 'OPEN' WHERE id = ? AND status != 'PLAYED'").run(existing.id);
      }
    });
    transaction();
    return ensureUpcomingMatch(candidateDate);
  }
  throw new Error('No se encontró una fecha disponible para abrir una convocatoria.');
}

export function cancelUpcomingMatch(matchId: number, now = new Date()): Match {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as Match | undefined;
  if (!match) throw new Error('No se encontró la convocatoria que quieres cancelar.');
  if (match.status === 'PLAYED' || match.score_a !== null || match.score_b !== null) {
    throw new Error('No se puede cancelar una convocatoria que ya tiene un resultado registrado.');
  }
  if (isMatchCancelled(match.match_date)) throw new Error('Esta convocatoria ya estaba cancelada.');
  if (zonedDateTimeToUtc(match.match_date, match.starts_at.slice(11), config.timezone).getTime() <= now.getTime()) {
    throw new Error('Solo se puede cancelar una convocatoria antes de la hora del partido.');
  }

  db.transaction(() => {
    db.prepare('INSERT INTO cancelled_matches (match_date) VALUES (?)').run(match.match_date);
    for (const table of ['attendance', 'payments', 'mvp_votes', 'rating_history', 'cancellations', 'roster']) {
      db.prepare(`DELETE FROM ${table} WHERE match_id = ?`).run(match.id);
    }
    db.prepare(`
      UPDATE matches SET status = 'CLOSED', score_a = NULL, score_b = NULL, result_recorded_at = NULL
      WHERE id = ?
    `).run(match.id);
  })();
  return { ...match, status: 'CANCELLED' };
}

export function deleteMatchByDate(date: string): Match | undefined {
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date) {
    throw new Error('La fecha debe tener formato válido AAAA-MM-DD.');
  }

  const match = db.prepare('SELECT * FROM matches WHERE match_date = ?').get(date) as Match | undefined;
  if (!match) return undefined;

  const transaction = db.transaction(() => {
    const ratingChanges = db.prepare(`
      SELECT rh.player_id AS playerId, rh.old_rating AS oldRating
      FROM rating_history rh
      WHERE rh.match_id = ?
    `).all(match.id) as Array<{ playerId: string; oldRating: number }>;

    const laterRatingChange = db.prepare(`
      SELECT 1
      FROM rating_history current
      JOIN matches current_match ON current_match.id = current.match_id
      JOIN rating_history later ON later.player_id = current.player_id
      JOIN matches later_match ON later_match.id = later.match_id
      WHERE current.match_id = ? AND later_match.match_date > current_match.match_date
      LIMIT 1
    `).get(match.id);
    if (laterRatingChange) {
      throw new Error('No se puede borrar este partido porque hay ratings posteriores. Corrige el historial manualmente para evitar alterar ratings válidos.');
    }

    const restoreRating = db.prepare('UPDATE players SET rating = ? WHERE id = ?');
    for (const change of ratingChanges) restoreRating.run(change.oldRating, change.playerId);
    db.prepare('DELETE FROM cancelled_matches WHERE match_date = ?').run(date);
    db.prepare('DELETE FROM matches WHERE id = ?').run(match.id);
  });
  transaction();
  return match;
}

export function getRoster(matchId: number): RosterRow[] {
  return orm.select({
    id: players.id,
    name: players.name,
    position: players.position,
    rating: players.rating,
    status: rosterTable.status,
    joined_at: rosterTable.joinedAt
  })
    .from(rosterTable)
    .innerJoin(players, eq(players.id, rosterTable.playerId))
    .where(eq(rosterTable.matchId, matchId))
    .orderBy(rosterTable.joinedAt, players.id)
    .all();
}

export function ensurePlayer(id: string, name: string): Player {
  orm.insert(players).values({ id, name: name || id }).onConflictDoNothing().run();
  orm.update(players).set({ name: name || id }).where(and(eq(players.id, id), eq(players.name, id))).run();
  const player = orm.select({
    id: players.id, name: players.name, position: players.position, rating: players.rating
  }).from(players).where(eq(players.id, id)).get();
  if (!player) throw new Error(`No se pudo cargar el perfil de ${id}.`);
  return player;
}

export function findPlayerByIds(ids: string[]): Player | undefined {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return undefined;
  const placeholders = uniqueIds.map(() => '?').join(', ');
  return db.prepare(`
    SELECT id, name, position, rating FROM players
    WHERE id IN (${placeholders})
    ORDER BY CASE id ${uniqueIds.map((_, index) => `WHEN ? THEN ${index}`).join(' ')} END
    LIMIT 1
  `).get(...uniqueIds, ...uniqueIds) as Player | undefined;
}

export function updatePlayerName(id: string, name: string): void {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('El nombre del jugador no puede estar vacío.');
  const result = db.prepare('UPDATE players SET name = ? WHERE id = ?').run(normalizedName, id);
  if (result.changes === 0) throw new Error(`No se encontró el perfil del jugador ${id}.`);
}

function persistQueue(match: Match, queue: QueueResult, clearTeams: boolean): string[] {
  const confirmedIds = new Set(queue.confirmed.map((entry) => entry.playerId));
  const allEntries = [
    ...queue.confirmed.map((entry) => ({ ...entry, status: 'CONFIRMED' as const })),
    ...queue.waitlist.map((entry) => ({ ...entry, status: 'WAITLIST' as const }))
  ];
  const existing = new Set(getRoster(match.id).map((entry) => entry.id));
  const insert = db.prepare('INSERT INTO roster (match_id, player_id, status, joined_at) VALUES (?, ?, ?, ?)');
  const update = db.prepare('UPDATE roster SET status = ?, team = CASE WHEN ? THEN NULL ELSE team END WHERE match_id = ? AND player_id = ?');
  const transaction = db.transaction(() => {
    for (const entry of allEntries) {
      if (existing.has(entry.playerId)) update.run(entry.status, clearTeams ? 1 : 0, match.id, entry.playerId);
      else insert.run(match.id, entry.playerId, entry.status, entry.joinedAt);
    }
  });
  transaction();
  return [...confirmedIds];
}

export function registerPlayer(match: Match, player: Player): { status: 'CONFIRMED' | 'WAITLIST'; promoted?: string } {
  if (match.status !== 'OPEN') throw new Error('La convocatoria está cerrada.');
  if (zonedDateTimeToUtc(match.match_date, match.starts_at.slice(11), config.timezone).getTime() <= Date.now()) {
    throw new Error('El partido ya ha comenzado; no se pueden modificar las inscripciones.');
  }
  const current = getRoster(match.id);
  const existing = current.find((entry) => entry.id === player.id);
  const entries = current.map((entry) => ({ playerId: entry.id, joinedAt: entry.joined_at }));
  const queue = addToQueue(entries, player.id, match.capacity);
  const confirmed = persistQueue(match, queue, !existing);
  db.prepare("INSERT INTO payments (match_id, player_id, status) VALUES (?, ?, 'UNPAID') ON CONFLICT(match_id, player_id) DO NOTHING")
    .run(match.id, player.id);
  return { status: confirmed.includes(player.id) ? 'CONFIRMED' : 'WAITLIST' };
}

export function dropPlayer(match: Match, playerId: string): { removed: boolean; promoted?: Player } {
  if (match.status !== 'OPEN') throw new Error('La convocatoria ya está cerrada.');
  if (zonedDateTimeToUtc(match.match_date, match.starts_at.slice(11), config.timezone).getTime() <= Date.now()) {
    throw new Error('El partido ya ha comenzado; no se pueden modificar las inscripciones.');
  }
  const current = getRoster(match.id);
  const existing = current.find((entry) => entry.id === playerId);
  if (!existing) return { removed: false };
  const entries = sortQueueEntries(current.map((entry) => ({ playerId: entry.id, joinedAt: entry.joined_at })));
  const result = removeFromQueue(entries, playerId, match.capacity);
  const promotedId = result.promoted;
  const start = zonedDateTimeToUtc(match.match_date, match.starts_at.slice(11), config.timezone);
  const late = existing.status === 'CONFIRMED' && Number.isFinite(start.getTime()) &&
    start.getTime() - Date.now() <= 24 * 60 * 60 * 1000 && start.getTime() - Date.now() >= 0;
  db.transaction(() => {
    db.prepare('INSERT INTO cancellations (match_id, player_id, was_confirmed, late) VALUES (?, ?, ?, ?)')
      .run(match.id, playerId, existing.status === 'CONFIRMED' ? 1 : 0, late ? 1 : 0);
    if (late) {
      db.prepare(`
        INSERT INTO attendance (match_id, player_id, status) VALUES (?, ?, 'LATE_CANCEL')
        ON CONFLICT(match_id, player_id) DO UPDATE SET status = 'LATE_CANCEL'
      `).run(match.id, playerId);
    }
    db.prepare('DELETE FROM roster WHERE match_id = ? AND player_id = ?').run(match.id, playerId);
    for (const entry of [...result.confirmed, ...result.waitlist]) {
      db.prepare('UPDATE roster SET status = ?, team = NULL WHERE match_id = ? AND player_id = ?')
        .run(result.confirmed.some((confirmed) => confirmed.playerId === entry.playerId) ? 'CONFIRMED' : 'WAITLIST', match.id, entry.playerId);
    }
  })();
  const promoted = promotedId ? db.prepare('SELECT id, name, position, rating FROM players WHERE id = ?').get(promotedId) as Player | undefined : undefined;
  return { removed: true, ...(promoted ? { promoted } : {}) };
}

export function closeMatch(matchId: number): void {
  db.prepare("UPDATE matches SET status = 'CLOSED' WHERE id = ? AND status = 'OPEN'").run(matchId);
}

export function setPlayerProfile(id: string, position: Player['position'], rating: number): void {
  if (!['GK', 'DEF', 'MID', 'FWD'].includes(position) || !Number.isFinite(rating) || rating < 1 || rating > 10) {
    throw new Error('Perfil inválido: posición GK/DEF/MID/FWD y rating de 1 a 10.');
  }
  orm.update(players).set({ position, rating }).where(eq(players.id, id)).run();
}

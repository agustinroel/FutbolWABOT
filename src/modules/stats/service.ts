import { db } from '../../database/client.js';
import type { Match } from '../matches/service.js';

export interface PlayerStats {
  name: string;
  rating: number;
  matches: number;
  attended: number;
  lateCancellations: number;
  noShows: number;
  wins: number;
  draws: number;
  losses: number;
  attendanceRate: number;
}

export interface PlayerDirectoryEntry extends PlayerStats {
  id: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
}

export interface PlayedMatchHistoryEntry {
  id: number;
  matchDate: string;
  scoreA: number;
  scoreB: number;
  attendance: number;
  mvp: string | null;
}

export interface MatchHistorySummary {
  totalPlayed: number;
  winsA: number;
  draws: number;
  winsB: number;
  totalGoals: number;
  averageGoals: number;
  attendedPlayers: number;
  noShows: number;
}

export interface MatchHistory {
  summary: MatchHistorySummary;
  recent: PlayedMatchHistoryEntry[];
}

export function getMatchHistory(limit = 5): MatchHistory {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error('La cantidad del historial debe ser un entero entre 1 y 20.');
  }

  const summary = db.prepare(`
    SELECT
      COUNT(*) AS totalPlayed,
      COALESCE(SUM(CASE WHEN score_a > score_b THEN 1 ELSE 0 END), 0) AS winsA,
      COALESCE(SUM(CASE WHEN score_a = score_b THEN 1 ELSE 0 END), 0) AS draws,
      COALESCE(SUM(CASE WHEN score_a < score_b THEN 1 ELSE 0 END), 0) AS winsB,
      COALESCE(SUM(score_a + score_b), 0) AS totalGoals,
      COALESCE(AVG(score_a + score_b), 0) AS averageGoals
    FROM matches
    WHERE status = 'PLAYED' AND score_a IS NOT NULL AND score_b IS NOT NULL
  `).get() as Omit<MatchHistorySummary, 'attendedPlayers' | 'noShows'>;

  const attendance = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END), 0) AS attendedPlayers,
      COALESCE(SUM(CASE WHEN a.status = 'NO_SHOW' THEN 1 ELSE 0 END), 0) AS noShows
    FROM attendance a
    JOIN matches m ON m.id = a.match_id
    WHERE m.status = 'PLAYED' AND m.score_a IS NOT NULL AND m.score_b IS NOT NULL
  `).get() as Pick<MatchHistorySummary, 'attendedPlayers' | 'noShows'>;

  const recent = db.prepare(`
    SELECT
      m.id,
      m.match_date AS matchDate,
      m.score_a AS scoreA,
      m.score_b AS scoreB,
      (SELECT COUNT(*) FROM attendance a
        WHERE a.match_id = m.id AND a.status = 'PRESENT') AS attendance,
      (SELECT p.name FROM mvp_votes v
        JOIN players p ON p.id = v.candidate_id
        WHERE v.match_id = m.id
        GROUP BY v.candidate_id
        ORDER BY COUNT(*) DESC, p.name COLLATE NOCASE
        LIMIT 1) AS mvp
    FROM matches m
    WHERE m.status = 'PLAYED' AND m.score_a IS NOT NULL AND m.score_b IS NOT NULL
    ORDER BY m.match_date DESC, m.id DESC
    LIMIT ?
  `).all(limit) as PlayedMatchHistoryEntry[];

  return { summary: { ...summary, ...attendance }, recent };
}

export function getAllPlayerStats(): PlayerDirectoryEntry[] {
  const players = db.prepare(`
    SELECT id, position FROM players
    ORDER BY name COLLATE NOCASE, id
  `).all() as Array<{ id: string; position: PlayerDirectoryEntry['position'] }>;

  return players.map(({ id, position }) => {
    const stats = getPlayerStats(id);
    if (!stats) throw new Error(`No se pudieron cargar las estadísticas del jugador ${id}.`);
    return { id, position, ...stats };
  });
}

export function recordResult(match: Match, goalsA: number, goalsB: number): void {
  if (!Number.isInteger(goalsA) || !Number.isInteger(goalsB) || goalsA < 0 || goalsB < 0) {
    throw new Error('El resultado debe incluir goles enteros no negativos.');
  }
  const players = db.prepare(`
    SELECT p.id, p.rating, r.team FROM roster r JOIN players p ON p.id = r.player_id
    WHERE r.match_id = ? AND r.status = 'CONFIRMED'
  `).all(match.id) as Array<{ id: string; rating: number; team: 'A' | 'B' | null }>;
  if (players.length < 2 || players.some((player) => player.team === null)) {
    throw new Error('Primero apunta al menos a dos jugadores y ejecuta /armar_equipos.');
  }

  const scoreA = goalsA > goalsB ? 1 : goalsA === goalsB ? 0.5 : 0;
  const transaction = db.transaction(() => {
    const updateMatch = db.prepare(`
      UPDATE matches SET score_a = ?, score_b = ?, status = 'PLAYED', result_recorded_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status != 'PLAYED'
    `).run(goalsA, goalsB, match.id);
    if (updateMatch.changes === 0) throw new Error('El resultado de este partido ya se registró.');

    for (const player of players) {
      const ownScore = player.team === 'A' ? scoreA : 1 - scoreA;
      const expected = player.team === 'A'
        ? 1 / (1 + 10 ** ((teamAverage(players, 'B') - teamAverage(players, 'A')) / 4))
        : 1 / (1 + 10 ** ((teamAverage(players, 'A') - teamAverage(players, 'B')) / 4));
      const newRating = Math.max(1, Math.min(10, player.rating + 0.35 * (ownScore - expected)));
      db.prepare('UPDATE players SET rating = ? WHERE id = ?').run(newRating, player.id);
      db.prepare('INSERT INTO rating_history (match_id, player_id, old_rating, new_rating) VALUES (?, ?, ?, ?)')
        .run(match.id, player.id, player.rating, newRating);
      db.prepare(`
        INSERT INTO attendance (match_id, player_id, status) VALUES (?, ?, 'PRESENT')
        ON CONFLICT(match_id, player_id) DO NOTHING
      `).run(match.id, player.id);
    }
  });
  transaction();
}

function teamAverage(players: Array<{ rating: number; team: 'A' | 'B' | null }>, team: 'A' | 'B'): number {
  const members = players.filter((player) => player.team === team);
  return members.reduce((sum, player) => sum + player.rating, 0) / members.length;
}

export function markNoShow(matchId: number, playerId: string): void {
  const result = db.prepare(`
    UPDATE attendance SET status = 'NO_SHOW'
    WHERE match_id = ? AND player_id = ? AND status = 'PRESENT'
  `).run(matchId, playerId);
  if (result.changes === 0) throw new Error('El jugador no figura como asistente en el resultado de este partido.');
}

export function getPlayerStats(playerId: string): PlayerStats | undefined {
  return db.prepare(`
    SELECT p.name, p.rating,
      (SELECT COUNT(*) FROM attendance a WHERE a.player_id = p.id AND a.status IN ('PRESENT', 'NO_SHOW', 'LATE_CANCEL')) AS matches,
      (SELECT COUNT(*) FROM attendance a WHERE a.player_id = p.id AND a.status = 'PRESENT') AS attended,
      (SELECT COUNT(*) FROM attendance a WHERE a.player_id = p.id AND a.status = 'LATE_CANCEL') AS lateCancellations,
      (SELECT COUNT(*) FROM attendance a WHERE a.player_id = p.id AND a.status = 'NO_SHOW') AS noShows,
      (SELECT COUNT(*) FROM roster r JOIN matches m ON m.id = r.match_id
        WHERE r.player_id = p.id AND r.status = 'CONFIRMED' AND m.status = 'PLAYED'
          AND EXISTS (SELECT 1 FROM attendance a WHERE a.match_id = m.id AND a.player_id = p.id AND a.status = 'PRESENT')
          AND ((r.team = 'A' AND m.score_a > m.score_b) OR (r.team = 'B' AND m.score_b > m.score_a))) AS wins,
      (SELECT COUNT(*) FROM roster r JOIN matches m ON m.id = r.match_id
        WHERE r.player_id = p.id AND r.status = 'CONFIRMED' AND m.status = 'PLAYED' AND m.score_a = m.score_b
          AND EXISTS (SELECT 1 FROM attendance a WHERE a.match_id = m.id AND a.player_id = p.id AND a.status = 'PRESENT')) AS draws,
      (SELECT COUNT(*) FROM roster r JOIN matches m ON m.id = r.match_id
        WHERE r.player_id = p.id AND r.status = 'CONFIRMED' AND m.status = 'PLAYED'
          AND EXISTS (SELECT 1 FROM attendance a WHERE a.match_id = m.id AND a.player_id = p.id AND a.status = 'PRESENT')
          AND ((r.team = 'A' AND m.score_a < m.score_b) OR (r.team = 'B' AND m.score_b < m.score_a))) AS losses,
      CASE WHEN (SELECT COUNT(*) FROM attendance a WHERE a.player_id = p.id) = 0 THEN 0.0
        ELSE 100.0 * (SELECT COUNT(*) FROM attendance a WHERE a.player_id = p.id AND a.status = 'PRESENT')
          / (SELECT COUNT(*) FROM attendance a WHERE a.player_id = p.id) END AS attendanceRate
    FROM players p WHERE p.id = ?
  `).get(playerId) as PlayerStats | undefined;
}

export function castMvpVote(match: Match, voterId: string, candidateId: string): void {
  const recorded = db.prepare('SELECT result_recorded_at FROM matches WHERE id = ? AND status = ?')
    .get(match.id, 'PLAYED') as { result_recorded_at: string | null } | undefined;
  const recordedAt = recorded?.result_recorded_at ? Date.parse(`${recorded.result_recorded_at.replace(' ', 'T')}Z`) : Number.NaN;
  if (!Number.isFinite(recordedAt) || Date.now() > recordedAt + 2 * 60 * 60 * 1000) {
    throw new Error('La votación MVP solo está abierta durante las dos horas posteriores al partido.');
  }
  const eligible = db.prepare(`
    SELECT COUNT(*) AS count FROM roster WHERE match_id = ? AND player_id IN (?, ?) AND status = 'CONFIRMED'
  `).get(match.id, voterId, candidateId) as { count: number };
  if (eligible.count !== 2 || voterId === candidateId) throw new Error('Votante y candidato deben ser jugadores distintos de la convocatoria.');
  db.prepare(`
    INSERT INTO mvp_votes (match_id, voter_id, candidate_id) VALUES (?, ?, ?)
    ON CONFLICT(match_id, voter_id) DO UPDATE SET candidate_id = excluded.candidate_id, created_at = CURRENT_TIMESTAMP
  `).run(match.id, voterId, candidateId);
}

export function getLatestMvpMatch(): Match | undefined {
  return db.prepare(`
    SELECT * FROM matches WHERE status = 'PLAYED' AND result_recorded_at >= datetime('now', '-2 hours')
    ORDER BY result_recorded_at DESC LIMIT 1
  `).get() as Match | undefined;
}

export function getLatestPlayedMatch(): Match | undefined {
  return db.prepare(`
    SELECT * FROM matches WHERE status = 'PLAYED'
    ORDER BY result_recorded_at DESC LIMIT 1
  `).get() as Match | undefined;
}

export function getMvpWinner(matchId: number): string | undefined {
  const row = db.prepare(`
    SELECT p.name FROM mvp_votes v JOIN players p ON p.id = v.candidate_id
    WHERE v.match_id = ? GROUP BY v.candidate_id ORDER BY COUNT(*) DESC, p.name ASC LIMIT 1
  `).get(matchId) as { name: string } | undefined;
  return row?.name;
}

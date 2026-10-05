import { createServer, type IncomingMessage, type Server } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../../config/env.js';
import { db } from '../../database/client.js';
import { getActiveMatch } from '../matches/service.js';
import { getAllPlayerStats, getMatchHistory } from '../stats/service.js';

function authorized(request: IncomingMessage): boolean {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(config.dashboardApiToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function dashboardData(): Record<string, unknown> {
  const publicId = (id: string): string => createHmac('sha256', config.dashboardApiToken)
    .update(id)
    .digest('hex')
    .slice(0, 16);
  const match = getActiveMatch();
  const currentRosterRows = match.status === 'CANCELLED' ? [] : db.prepare(`
    SELECT p.id, p.name, p.position, p.rating, r.status, r.team,
      COALESCE(pay.status, 'UNPAID') AS paymentStatus
    FROM roster r JOIN players p ON p.id = r.player_id
    LEFT JOIN payments pay ON pay.match_id = r.match_id AND pay.player_id = r.player_id
    WHERE r.match_id = ?
    ORDER BY r.status = 'WAITLIST', r.joined_at, p.id
  `).all(match.id) as Array<{
    id: string;
    name: string;
    position: string;
    rating: number;
    status: 'CONFIRMED' | 'WAITLIST';
    team: 'A' | 'B' | null;
    paymentStatus: 'UNPAID' | 'PENDING_CONFIRMATION' | 'PAID';
  }>;
  const currentRoster = currentRosterRows.map(({ id, ...player }) => ({ ...player, id: publicId(id) }));

  const players = getAllPlayerStats().map((player) => {
    const change = db.prepare(`
      SELECT new_rating - old_rating AS ratingChange
      FROM rating_history
      WHERE player_id = ?
      ORDER BY rowid DESC
      LIMIT 1
    `).get(player.id) as { ratingChange: number } | undefined;
    return { ...player, id: publicId(player.id), ratingChange: change?.ratingChange ?? 0 };
  });

  const history = getMatchHistory(20);
  const historyRoster = db.prepare(`
    SELECT r.match_id AS matchId, p.name, p.position, r.team
    FROM roster r JOIN players p ON p.id = r.player_id
    WHERE r.match_id IN (${history.recent.map(() => '?').join(',') || 'NULL'})
      AND r.status = 'CONFIRMED'
    ORDER BY r.joined_at
  `).all(...history.recent.map(({ id }) => id)) as Array<{
    matchId: number;
    name: string;
    position: string;
    team: 'A' | 'B' | null;
  }>;

  return {
    generatedAt: new Date().toISOString(),
    currentMatch: {
      id: match.id,
      date: match.match_date,
      time: match.starts_at.slice(11),
      location: match.location,
      capacity: match.capacity,
      status: match.status,
      roster: currentRoster
    },
    leaderboard: players,
    history: {
      summary: history.summary,
      matches: history.recent.map((entry) => ({
        ...entry,
        roster: historyRoster.filter((player) => player.matchId === entry.id)
      }))
    }
  };
}

export function startDashboardApi(
  port = config.dashboardApiPort,
  host = config.dashboardApiHost
): Server {
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (request.method !== 'GET' || request.url !== '/api/dashboard') {
      response.writeHead(404).end();
      return;
    }
    if (!config.dashboardApiToken) {
      response.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Dashboard API is not configured' }));
      return;
    }
    if (!authorized(request)) {
      response.writeHead(401, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    try {
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8'
      });
      response.end(JSON.stringify(dashboardData()));
    } catch (error) {
      console.error('Error preparando los datos del dashboard:', error);
      response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Dashboard data unavailable' }));
    }
  });

  server.listen(port, host, () => {
    console.info(`Dashboard API activa en ${host}:${port}.`);
  });
  if (!config.dashboardApiToken) {
    console.warn('Dashboard API sin DASHBOARD_API_TOKEN: solo está disponible la comprobación de salud.');
  }
  return server;
}

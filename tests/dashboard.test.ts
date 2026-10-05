import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import test from 'node:test';

const testDataDirectory = mkdtempSync(path.join(tmpdir(), 'montemar-dashboard-'));
process.env.DATABASE_PATH = path.join(testDataDirectory, 'test.sqlite');
process.env.DASHBOARD_API_TOKEN = 'dashboard-test-token';

const { db } = await import('../src/database/client.js');
const { startDashboardApi } = await import('../src/modules/dashboard/api.js');
const { ensurePlayer, getActiveMatch, registerPlayer } = await import('../src/modules/matches/service.js');

test('serves dashboard data only with a valid bearer token', async () => {
  const match = getActiveMatch();
  const player = ensurePlayer('34600123456@c.us', 'Panel Player');
  registerPlayer(match, player);
  const server = startDashboardApi(0, '127.0.0.1');
  assert.ok(server);
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const endpoint = `http://127.0.0.1:${address.port}/api/dashboard`;

  try {
    const unauthorized = await fetch(endpoint);
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(endpoint, {
      headers: { authorization: 'Bearer dashboard-test-token' }
    });
    assert.equal(authorized.status, 200);
    assert.equal(authorized.headers.get('cache-control'), 'no-store');
    const payload = await authorized.json() as {
      currentMatch: { status: string; roster: Array<{ id: string; name: string }> };
      leaderboard: Array<{ id: string; name: string }>;
      history: { summary: { totalPlayed: number }; matches: unknown[] };
    };
    assert.equal(payload.currentMatch.status, 'OPEN');
    assert.equal(payload.currentMatch.roster[0]?.name, 'Panel Player');
    assert.notEqual(payload.currentMatch.roster[0]?.id, player.id);
    assert.equal(payload.leaderboard[0]?.name, 'Panel Player');
    assert.notEqual(payload.leaderboard[0]?.id, player.id);
    assert.equal(payload.history.summary.totalPlayed, 0);
    assert.deepEqual(payload.history.matches, []);
  } finally {
    server.close();
    await once(server, 'close');
    db.close();
    rmSync(testDataDirectory, { recursive: true, force: true });
  }
});

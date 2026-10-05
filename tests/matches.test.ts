import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const testDataDirectory = mkdtempSync(path.join(tmpdir(), 'montemar-matches-'));
process.env.DATABASE_PATH = path.join(testDataDirectory, 'test.sqlite');
process.env.MATCH_CAPACITY = '14';

const { db } = await import('../src/database/client.js');
const {
  ensurePlayer,
  cancelUpcomingMatch,
  deleteMatchByDate,
  ensureNextMatchAfter,
  getActiveMatch,
  ensureUpcomingMatch,
  getUpcomingMatchDate,
  findPlayerByIds,
  getRoster,
  nextThursdayDate,
  openUpcomingMatch,
  registerPlayer,
  updatePlayerName
} = await import('../src/modules/matches/service.js');
const { getAllPlayerStats, getMatchHistory } = await import('../src/modules/stats/service.js');
const { confirmPayment, isPaymentProofIntent, listDebtors, reportPayment } = await import('../src/modules/payments/service.js');

test('persists the first registration as confirmed and includes it in the roster', () => {
  const match = ensureUpcomingMatch(nextThursdayDate());
  const player = ensurePlayer('34600000001@c.us', 'Test Player');

  const registration = registerPlayer(match, player);

  assert.equal(registration.status, 'CONFIRMED');
  assert.deepEqual(
    getRoster(match.id).map(({ id, status }) => ({ id, status })),
    [{ id: player.id, status: 'CONFIRMED' }]
  );
});

test('repairs the roster status when an existing player confirms again', () => {
  const match = ensureUpcomingMatch(nextThursdayDate());
  const player = ensurePlayer('34600000002@c.us', 'Repeat Player');
  db.prepare(`
    INSERT INTO roster (match_id, player_id, status, joined_at)
    VALUES (?, ?, 'WAITLIST', ?)
  `).run(match.id, player.id, new Date().toISOString());

  const registration = registerPlayer(match, player);

  assert.equal(registration.status, 'CONFIRMED');
  assert.equal(getRoster(match.id).find((entry) => entry.id === player.id)?.status, 'CONFIRMED');
});

test('updates a manually summoned player display name instead of keeping the mention ID', () => {
  const player = ensurePlayer('34600000003@c.us', '@Q34600000003');

  updatePlayerName(player.id, 'María Pérez');

  const updated = db.prepare('SELECT name FROM players WHERE id = ?').get(player.id) as { name: string };
  assert.equal(updated.name, 'María Pérez');
});

test('finds a stored player by either WhatsApp phone or LID alias', () => {
  const player = ensurePlayer('34600000008@c.us', 'Alias Player');

  assert.equal(findPlayerByIds(['123456789012@lid', player.id])?.id, player.id);
  assert.equal(findPlayerByIds(['123456789012@lid']), undefined);
});

test('lists all player profiles with their basic statistics', () => {
  const player = ensurePlayer('34600000004@c.us', 'Directory Player');
  const entry = getAllPlayerStats().find(({ id }) => id === player.id);

  assert.ok(entry);
  assert.equal(entry.name, 'Directory Player');
  assert.equal(entry.position, 'MID');
  assert.equal(entry.matches, 0);
  assert.equal(entry.attendanceRate, 0);
  assert.equal(entry.wins, 0);
});

test('lists only unpaid and pending-confirmation players as debtors', () => {
  const match = ensureUpcomingMatch(nextThursdayDate());
  const unpaid = ensurePlayer('34600000005@c.us', 'Unpaid Player');
  const reported = ensurePlayer('34600000006@c.us', 'Reported Player');
  const paid = ensurePlayer('34600000007@c.us', 'Paid Player');
  for (const player of [unpaid, reported, paid]) registerPlayer(match, player);

  assert.equal(reportPayment(match, reported.id), 'PENDING_CONFIRMATION');
  assert.equal(reportPayment(match, reported.id), 'PENDING_CONFIRMATION');
  assert.equal(reportPayment(match, paid.id), 'PENDING_CONFIRMATION');
  confirmPayment(match, paid.id);
  assert.equal(reportPayment(match, paid.id), 'PAID');

  const debtors = listDebtors(match.id);
  assert.deepEqual(
    debtors.filter(({ id }) => [unpaid.id, reported.id, paid.id].includes(id))
      .map(({ id, name }) => ({ id, name })),
    [
      { id: unpaid.id, name: unpaid.name },
      { id: reported.id, name: reported.name }
    ]
  );
});

test('recognizes payment proof captions only on image messages', () => {
  assert.equal(isPaymentProofIntent('image', 'Comprobante Bizum'), true);
  assert.equal(isPaymentProofIntent('image', 'Ya pagué'), true);
  assert.equal(isPaymentProofIntent('image', 'Pago realizado'), true);
  assert.equal(isPaymentProofIntent('image', 'Pagué el Bizum'), true);
  assert.equal(isPaymentProofIntent('image', 'Buenas, aquí va el pago'), true);
  assert.equal(isPaymentProofIntent('image', 'Foto del partido'), false);
  assert.equal(isPaymentProofIntent('chat', 'Ya hice el pago'), false);
});

test('summarizes played match results and returns newest games first', () => {
  assert.equal(getMatchHistory().summary.totalPlayed, 0);
  db.prepare(`
    INSERT INTO matches (match_date, capacity, location, starts_at, status, score_a, score_b)
    VALUES
      ('2026-01-01', 10, 'Montemar', '2026-01-01T20:00', 'PLAYED', 2, 1),
      ('2026-01-08', 10, 'Montemar', '2026-01-08T20:00', 'PLAYED', 3, 3)
  `).run();

  const firstMatch = db.prepare('SELECT id FROM matches WHERE match_date = ?').get('2026-01-01') as { id: number };
  const present = ensurePlayer('34600000009@c.us', 'Present Player');
  const noShow = ensurePlayer('34600000010@c.us', 'No-show Player');
  db.prepare(`
    INSERT INTO attendance (match_id, player_id, status)
    VALUES (?, ?, 'PRESENT'), (?, ?, 'NO_SHOW')
  `).run(firstMatch.id, present.id, firstMatch.id, noShow.id);

  const history = getMatchHistory(1);

  assert.equal(history.summary.totalPlayed, 2);
  assert.equal(history.summary.winsA, 1);
  assert.equal(history.summary.draws, 1);
  assert.equal(history.summary.winsB, 0);
  assert.equal(history.summary.totalGoals, 9);
  assert.equal(history.summary.averageGoals, 4.5);
  assert.equal(history.summary.attendedPlayers, 1);
  assert.equal(history.summary.noShows, 1);
  assert.equal(history.recent.length, 1);
  assert.equal(history.recent[0]?.matchDate, '2026-01-08');
  assert.throws(() => getMatchHistory(21), /entre 1 y 20/);
});

test('advances to the next match after a result and prepares it idempotently', () => {
  const current = ensureUpcomingMatch(nextThursdayDate());
  db.prepare("UPDATE matches SET status = 'PLAYED' WHERE id = ?").run(current.id);

  const active = getActiveMatch();
  assert.notEqual(active.match_date, current.match_date);
  assert.equal(active.status, 'OPEN');

  const preparedAgain = ensureNextMatchAfter(current);
  assert.equal(preparedAgain.id, active.id);
  assert.equal(preparedAgain.match_date, active.match_date);
});

test('selects this Thursday only while it is still upcoming in the configured timezone', () => {
  const upcoming = (date: string): string => getUpcomingMatchDate(new Date(date), 'Europe/Madrid', '20:00');
  assert.equal(upcoming('2026-10-05T12:00:00.000Z'), '2026-10-08');
  assert.equal(upcoming('2026-10-08T15:00:00.000Z'), '2026-10-08');
  assert.equal(upcoming('2026-10-08T19:00:00.000Z'), '2026-10-15');
  assert.equal(upcoming('2026-10-09T08:00:00.000Z'), '2026-10-15');
});

test('cancels the active convocatoria and reopens the appropriate Thursday date', () => {
  const match = ensureUpcomingMatch('2026-10-15');
  const player = ensurePlayer('34600000013@c.us', 'Cancelled Match Player');
  registerPlayer(match, player);

  assert.equal(getActiveMatch(new Date('2026-10-15T20:00:00.000Z')).match_date, '2026-10-15');
  cancelUpcomingMatch(match.id, new Date('2026-10-05T12:00:00.000Z'));
  assert.equal(getActiveMatch(new Date('2026-10-05T12:00:00.000Z')).status, 'CANCELLED');
  assert.equal(getRoster(match.id).length, 0);
  assert.equal((db.prepare('SELECT COUNT(*) AS count FROM payments WHERE match_id = ?')
    .get(match.id) as { count: number }).count, 0);

  const reopenedBeforeMatchDay = openUpcomingMatch(new Date('2026-10-05T12:00:00.000Z'));
  assert.equal(reopenedBeforeMatchDay.id, match.id);
  assert.equal(reopenedBeforeMatchDay.match_date, '2026-10-15');
  assert.equal(reopenedBeforeMatchDay.status, 'OPEN');

  cancelUpcomingMatch(match.id, new Date('2026-10-05T12:00:00.000Z'));
  const reopenedAfterPreviousThursday = openUpcomingMatch(new Date('2026-10-09T08:00:00.000Z'));
  assert.equal(reopenedAfterPreviousThursday.match_date, '2026-10-15');
  assert.equal(reopenedAfterPreviousThursday.status, 'OPEN');
});

test('deletes a test match, restores pre-match ratings, and cascades its records', () => {
  const match = ensureUpcomingMatch('2026-11-05');
  const player = ensurePlayer('34600000011@c.us', 'Rating Restore Player');
  const opponent = ensurePlayer('34600000012@c.us', 'Rating Opponent');
  registerPlayer(match, player);
  registerPlayer(match, opponent);
  db.prepare("UPDATE roster SET team = CASE WHEN player_id = ? THEN 'A' ELSE 'B' END WHERE match_id = ?")
    .run(player.id, match.id);
  db.prepare("UPDATE matches SET status = 'PLAYED', score_a = 2, score_b = 1 WHERE id = ?").run(match.id);
  db.prepare(`
    INSERT INTO rating_history (match_id, player_id, old_rating, new_rating)
    VALUES (?, ?, 5, 5.2), (?, ?, 5, 4.8)
  `).run(match.id, player.id, match.id, opponent.id);
  db.prepare('UPDATE players SET rating = 5.2 WHERE id = ?').run(player.id);
  db.prepare('UPDATE players SET rating = 4.8 WHERE id = ?').run(opponent.id);
  db.prepare('INSERT INTO attendance (match_id, player_id, status) VALUES (?, ?, ?)')
    .run(match.id, player.id, 'PRESENT');
  db.prepare('UPDATE payments SET status = ? WHERE match_id = ? AND player_id = ?')
    .run('PAID', match.id, player.id);

  const deleted = deleteMatchByDate('2026-11-05');

  assert.equal(deleted?.id, match.id);
  assert.equal((db.prepare('SELECT COUNT(*) AS count FROM matches WHERE id = ?').get(match.id) as { count: number }).count, 0);
  assert.equal((db.prepare('SELECT rating FROM players WHERE id = ?').get(player.id) as { rating: number }).rating, 5);
  assert.equal((db.prepare('SELECT rating FROM players WHERE id = ?').get(opponent.id) as { rating: number }).rating, 5);
  assert.equal((db.prepare('SELECT COUNT(*) AS count FROM attendance WHERE match_id = ?').get(match.id) as { count: number }).count, 0);
  assert.equal((db.prepare('SELECT COUNT(*) AS count FROM payments WHERE match_id = ?').get(match.id) as { count: number }).count, 0);
  assert.equal(deleteMatchByDate('2026-11-05'), undefined);
  assert.throws(() => deleteMatchByDate('2026-13-08'), /AAAA-MM-DD/);
});

test.after(() => {
  db.close();
  rmSync(testDataDirectory, { recursive: true, force: true });
});

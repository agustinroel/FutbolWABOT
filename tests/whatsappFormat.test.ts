import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCard, formatHelp, formatMatchHistory, formatPlayerDirectory, formatRoster } from '../src/utils/whatsapp-format.js';

test('formats the roster with capacity, numbered players, and explicit empty states', () => {
  const result = formatRoster(
    [{ name: 'Ana' }, { name: 'Luis' }],
    [{ name: 'Marta' }],
    10,
    '8 de octubre',
    'OPEN'
  );

  assert.match(result, /Convocatoria · Jueves 8 de octubre/);
  assert.match(result, /Abierta/);
  assert.match(result, /CONVOCADOS · 2\/10/);
  assert.match(result, /01\s+Ana/);
  assert.match(result, /SUPLENTES · 1/);
  assert.match(result, /01\s+Marta/);

  const empty = formatRoster([], [], 14);
  assert.match(empty, /Todavía no hay convocados/);
  assert.match(empty, /Sin suplentes por ahora/);
});

test('shows player commands to everyone and administrative commands only to admins', () => {
  const playerHelp = formatHelp(false);
  assert.match(playerHelp, /`\/voy` o `\+1`/);
  assert.doesNotMatch(playerHelp, /`\/cerrar`/);

  const adminHelp = formatHelp(true);
  assert.match(adminHelp, /`\/cerrar`/);
  assert.match(adminHelp, /`\/resultado <A>-<B>`/);
  assert.match(adminHelp, /`\/registrar_jugador/);
  assert.match(playerHelp, /`\/jugadores`/);
  assert.match(playerHelp, /`\/historial/);
  assert.match(playerHelp, /`\/plantilla`/);
  assert.doesNotMatch(playerHelp, /`\/deudores`/);
});

test('formats played match summary, recent results, and an empty state', () => {
  const history = formatMatchHistory({
    summary: {
      totalPlayed: 2,
      winsA: 1,
      draws: 1,
      winsB: 0,
      totalGoals: 9,
      averageGoals: 4.5,
      attendedPlayers: 18,
      noShows: 1
    },
    recent: [{
      matchDate: '2026-10-01',
      scoreA: 3,
      scoreB: 2,
      attendance: 9,
      mvp: 'Ana'
    }]
  }, 'Europe/Madrid');

  assert.match(history, /Jugados: \*2\*/);
  assert.match(history, /Equipo A: \*1\* · Empates: \*1\*/);
  assert.match(history, /3 — 2/);
  assert.match(history, /⭐ Ana/);

  const empty = formatMatchHistory({
    summary: {
      totalPlayed: 0, winsA: 0, draws: 0, winsB: 0,
      totalGoals: 0, averageGoals: 0, attendedPlayers: 0, noShows: 0
    },
    recent: []
  }, 'Europe/Madrid');
  assert.match(empty, /Todavía no hay resultados registrados/);
});

test('formats all-player profiles and splits large directories into pages', () => {
  const players = Array.from({ length: 12 }, (_, index) => ({
    name: `Player ${index + 1}`,
    position: 'MID',
    rating: 5.5,
    matches: 3,
    attendanceRate: 67,
    wins: 1,
    draws: 1,
    losses: 1
  }));

  const pages = formatPlayerDirectory(players, 400);

  assert.ok(pages.length > 1);
  assert.ok(pages.every((page) => page.length < 500));
  assert.match(pages[0] ?? '', /Player 1/);
  assert.match(pages[0] ?? '', /V\/E\/D 1\/1\/1/);
  assert.match(pages[0] ?? '', /1\/\d+/);
});

test('formats debtor lists with player names rather than WhatsApp identifiers', () => {
  const result = formatCard('PAGOS PENDIENTES', ['01  *María Pérez*', '02  *Luis*']);

  assert.match(result, /María Pérez/);
  assert.doesNotMatch(result, /@c\.us|@lid/);
});

test('uses a consistent WhatsApp card heading and divider', () => {
  assert.equal(formatCard('AVISO', ['Primera línea']), '*⚽ AVISO*\n━━━━━━━━━━━━━━\nPrimera línea');
});

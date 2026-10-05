import assert from 'node:assert/strict';
import test from 'node:test';
import { balanceTeams, type BalancePlayer } from '../src/modules/balancing/balancer.js';

test('splits ratings closely and keeps goalkeeper distribution balanced', () => {
  const players: BalancePlayer[] = [
    { id: '1', name: 'A', position: 'GK', rating: 9 },
    { id: '2', name: 'B', position: 'GK', rating: 4 },
    { id: '3', name: 'C', position: 'DEF', rating: 8 },
    { id: '4', name: 'D', position: 'DEF', rating: 5 },
    { id: '5', name: 'E', position: 'MID', rating: 7 },
    { id: '6', name: 'F', position: 'MID', rating: 6 },
    { id: '7', name: 'G', position: 'FWD', rating: 8 },
    { id: '8', name: 'H', position: 'FWD', rating: 4 }
  ];

  const result = balanceTeams(players);
  assert.equal(result.teamA.length, 4);
  assert.equal(result.teamB.length, 4);
  assert.ok(result.ratingDelta <= 1);
  assert.equal(result.teamA.filter((player) => player.position === 'GK').length, 1);
  assert.equal(result.teamB.filter((player) => player.position === 'GK').length, 1);
});

test('is deterministic regardless of input order', () => {
  const players: BalancePlayer[] = [
    { id: 'c', name: 'C', position: 'MID', rating: 6 },
    { id: 'a', name: 'A', position: 'DEF', rating: 8 },
    { id: 'b', name: 'B', position: 'FWD', rating: 5 },
    { id: 'd', name: 'D', position: 'GK', rating: 7 }
  ];
  const forward = balanceTeams(players);
  const reverse = balanceTeams([...players].reverse());
  assert.deepEqual(forward.teamA.map((player) => player.id), reverse.teamA.map((player) => player.id));
  assert.deepEqual(forward.teamB.map((player) => player.id), reverse.teamB.map((player) => player.id));
});

test('rejects an odd-sized squad', () => {
  assert.throws(() => balanceTeams([
    { id: 'a', name: 'A', position: 'MID', rating: 5 },
    { id: 'b', name: 'B', position: 'DEF', rating: 6 },
    { id: 'c', name: 'C', position: 'FWD', rating: 7 }
  ]), /número par/);
});

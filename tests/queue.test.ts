import assert from 'node:assert/strict';
import test from 'node:test';
import { addToQueue, removeFromQueue, type QueueEntry } from '../src/modules/matches/queue.js';

const entries: QueueEntry[] = [
  { playerId: 'a', joinedAt: '2026-01-01T10:00:00.000Z' },
  { playerId: 'b', joinedAt: '2026-01-01T10:01:00.000Z' },
  { playerId: 'c', joinedAt: '2026-01-01T10:02:00.000Z' }
];

test('confirms the first players and queues later registrations in order', () => {
  const result = addToQueue(entries, 'd', 2);
  assert.deepEqual(result.confirmed.map((entry) => entry.playerId), ['a', 'b']);
  assert.deepEqual(result.waitlist.map((entry) => entry.playerId), ['c', 'd']);
});

test('confirms the first registration in an empty match', () => {
  const result = addToQueue([], 'first-player', 14);
  assert.deepEqual(result.confirmed.map((entry) => entry.playerId), ['first-player']);
  assert.deepEqual(result.waitlist, []);
});

test('sorts legacy SQLite timestamps and ISO timestamps chronologically', () => {
  const result = addToQueue([
    { playerId: 'first', joinedAt: '2026-10-05 14:00:00' }
  ], 'second', 1);
  assert.deepEqual(result.confirmed.map((entry) => entry.playerId), ['first']);
  assert.deepEqual(result.waitlist.map((entry) => entry.playerId), ['second']);
});

test('promotes the first substitute after a confirmed player drops', () => {
  const result = removeFromQueue(entries, 'a', 2);
  assert.deepEqual(result.confirmed.map((entry) => entry.playerId), ['b', 'c']);
  assert.deepEqual(result.waitlist, []);
  assert.equal(result.promoted, 'c');
});

test('does not duplicate a player registration', () => {
  const result = addToQueue(entries, 'b', 2);
  assert.equal(result.confirmed.filter((entry) => entry.playerId === 'b').length, 1);
  assert.equal(result.waitlist.length, 1);
});

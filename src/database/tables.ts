import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { Position } from '../modules/balancing/balancer.js';

export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  position: text('position').$type<Position>().notNull().default('MID'),
  rating: real('rating').notNull().default(5),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const matches = sqliteTable('matches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchDate: text('match_date').notNull().unique(),
  capacity: integer('capacity').notNull(),
  location: text('location').notNull(),
  startsAt: text('starts_at').notNull(),
  status: text('status').$type<'OPEN' | 'CLOSED' | 'PLAYED'>().notNull().default('OPEN'),
  scoreA: integer('score_a'),
  scoreB: integer('score_b'),
  resultRecordedAt: text('result_recorded_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const roster = sqliteTable('roster', {
  matchId: integer('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull().references(() => players.id),
  status: text('status').$type<'CONFIRMED' | 'WAITLIST'>().notNull(),
  joinedAt: text('joined_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  team: text('team').$type<'A' | 'B'>()
}, (table) => [
  primaryKey({ columns: [table.matchId, table.playerId] }),
  index('roster_queue_idx').on(table.matchId, table.status, table.joinedAt)
]);

export const payments = sqliteTable('payments', {
  matchId: integer('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull().references(() => players.id),
  status: text('status').$type<'UNPAID' | 'PENDING_CONFIRMATION' | 'PAID'>().notNull(),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => [primaryKey({ columns: [table.matchId, table.playerId] })]);

export const mvpVotes = sqliteTable('mvp_votes', {
  matchId: integer('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  voterId: text('voter_id').notNull().references(() => players.id),
  candidateId: text('candidate_id').notNull().references(() => players.id),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => [primaryKey({ columns: [table.matchId, table.voterId] })]);

export const ratingHistory = sqliteTable('rating_history', {
  matchId: integer('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull().references(() => players.id),
  oldRating: real('old_rating').notNull(),
  newRating: real('new_rating').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, (table) => [primaryKey({ columns: [table.matchId, table.playerId] })]);

export const attendance = sqliteTable('attendance', {
  matchId: integer('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull().references(() => players.id),
  status: text('status').$type<'PRESENT' | 'NO_SHOW' | 'LATE_CANCEL'>().notNull()
}, (table) => [primaryKey({ columns: [table.matchId, table.playerId] })]);

export const cancellations = sqliteTable('cancellations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: integer('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull().references(() => players.id),
  cancelledAt: text('cancelled_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  wasConfirmed: integer('was_confirmed').notNull(),
  late: integer('late').notNull()
});

export const schema = { players, matches, roster, payments, mvpVotes, ratingHistory, attendance, cancellations };

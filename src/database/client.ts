import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/env.js';
import { schemaSql } from './schema.js';
import { schema } from './tables.js';

const databaseDirectory = path.dirname(config.databasePath);
fs.mkdirSync(databaseDirectory, { recursive: true });

export const db = new Database(config.databasePath);
export const orm = drizzle(db, { schema });
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate(): void {
  db.exec(schemaSql);
}

migrate();

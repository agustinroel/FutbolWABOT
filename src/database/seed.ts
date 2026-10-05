import { db } from './client.js';
import type { Position } from '../modules/balancing/balancer.js';

const positions = new Set<Position>(['GK', 'DEF', 'MID', 'FWD']);
const [phone, ...fields] = process.argv.slice(2);
const [name, rawPosition, rawRating] = fields;

if (!phone || !name || !rawPosition || !rawRating) {
  console.error('Uso: npm exec tsx src/database/seed.ts <telefono> "<nombre>" <GK|DEF|MID|FWD> <rating 1-10>');
  process.exitCode = 1;
} else {
  const id = phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@c.us`;
  const normalizedPosition = rawPosition.toUpperCase();
  const rating = Number(rawRating);
  if (!positions.has(normalizedPosition as Position) || !Number.isFinite(rating) || rating < 1 || rating > 10) {
    throw new Error('La posición debe ser GK, DEF, MID o FWD y el rating debe estar entre 1 y 10.');
  }
  const position = normalizedPosition as Position;
  db.prepare(`
    INSERT INTO players (id, name, position, rating) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, position = excluded.position, rating = excluded.rating
  `).run(id, name, position, rating);
  console.log(`Jugador ${name} guardado (${id}, ${position}, ${rating}).`);
}
db.close();

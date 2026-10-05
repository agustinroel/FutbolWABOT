import { db, migrate } from './client.js';

migrate();
console.log('Esquema SQLite actualizado correctamente.');
db.close();

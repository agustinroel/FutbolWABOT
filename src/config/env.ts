import 'dotenv/config';
import path from 'node:path';

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string
): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new Error(`${name} debe ser un entero positivo.`);
  return parsed;
}

function parseOptionalAmount(
  value: string | undefined,
  name: string
): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new Error(`${name} debe ser un importe válido.`);
  return parsed;
}

function parseBoolean(
  value: string | undefined,
  fallback: boolean,
  name: string
): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  if (value.trim().toLowerCase() === 'true') return true;
  if (value.trim().toLowerCase() === 'false') return false;
  throw new Error(`${name} debe ser true o false.`);
}

const matchTime = process.env.MATCH_TIME ?? '20:00';
if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(matchTime)) {
  throw new Error('MATCH_TIME debe tener formato HH:MM.');
}

export const config = {
  groupId: process.env.MONTEMAR_GROUP_ID?.trim() ?? '',
  adminIds: new Set(
    (process.env.ADMIN_PHONE_NUMBERS ?? '')
      .split(',')
      .map((phone) => phone.trim())
      .filter(Boolean)
      .map((phone) =>
        phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@c.us`
      )
  ),
  timezone: process.env.TIMEZONE?.trim() || 'Europe/Madrid',
  databasePath: path.resolve(
    process.env.DATABASE_PATH ?? './data/montemar.sqlite'
  ),
  puppeteerExecutablePath:
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim() || undefined,
  matchCapacity: parsePositiveInteger(
    process.env.MATCH_CAPACITY,
    14,
    'MATCH_CAPACITY'
  ),
  matchTime,
  location: process.env.PITCH_LOCATION?.trim() || 'Cancha Montemar, Alicante',
  feePerPlayer: parseOptionalAmount(
    process.env.FEE_PER_PLAYER,
    'FEE_PER_PLAYER'
  ),
  pitchCost: parseOptionalAmount(process.env.PITCH_COST, 'PITCH_COST'),
  dashboardApiEnabled: parseBoolean(
    process.env.DASHBOARD_API_ENABLED,
    true,
    'DASHBOARD_API_ENABLED'
  ),
  dashboardApiPort: parsePositiveInteger(
    process.env.DASHBOARD_API_PORT,
    8787,
    'DASHBOARD_API_PORT'
  ),
  dashboardApiHost: process.env.DASHBOARD_API_HOST?.trim() || '127.0.0.1',
  dashboardApiToken: process.env.DASHBOARD_API_TOKEN?.trim() || ''
};

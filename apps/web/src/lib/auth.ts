import { createHmac, timingSafeEqual } from 'node:crypto';

export const sessionCookieName = 'montemar_dashboard_session';

function sign(expiry: string): string {
  return createHmac('sha256', process.env.DASHBOARD_ACCESS_PASSWORD ?? '')
    .update(expiry)
    .digest('hex');
}

export function createSessionToken(): string {
  const expiry = String(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return `${expiry}.${sign(expiry)}`;
}

export function isValidSession(token: string | undefined): boolean {
  if (!token || !process.env.DASHBOARD_ACCESS_PASSWORD) return false;
  const [expiry, signature] = token.split('.');
  if (!expiry || !signature || Number(expiry) <= Date.now()) return false;
  const supplied = Buffer.from(signature);
  const expected = Buffer.from(sign(expiry));
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

export function verifyPassword(suppliedPassword: string): boolean {
  const expectedPassword = process.env.DASHBOARD_ACCESS_PASSWORD;
  if (!expectedPassword) return false;
  const supplied = Buffer.from(suppliedPassword);
  const expected = Buffer.from(expectedPassword);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

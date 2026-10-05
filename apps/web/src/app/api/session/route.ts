import { NextResponse } from 'next/server';
import {
  createSessionToken,
  sessionCookieName,
  verifyPassword
} from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  let body: { password?: unknown };
  try {
    body = (await request.json()) as { password?: unknown };
  } catch {
    return NextResponse.json(
      { error: 'La solicitud de acceso no es válida.' },
      { status: 400 }
    );
  }
  if (typeof body.password !== 'string' || !verifyPassword(body.password)) {
    return NextResponse.json(
      { error: 'Contraseña incorrecta.' },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60
  });
  return response;
}

export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(sessionCookieName);
  return response;
}

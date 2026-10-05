import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isValidSession, sessionCookieName } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();
  if (!isValidSession(cookieStore.get(sessionCookieName)?.value)) {
    return NextResponse.json(
      { error: 'Inicia sesión para consultar el panel.' },
      { status: 401 }
    );
  }

  const apiUrl = process.env.BOT_API_URL;
  const apiToken = process.env.BOT_API_TOKEN;
  if (!apiUrl || !apiToken) {
    return NextResponse.json(
      { error: 'Falta configurar BOT_API_URL o BOT_API_TOKEN en Vercel.' },
      { status: 503 }
    );
  }

  try {
    const upstream = await fetch(new URL('/api/dashboard', apiUrl), {
      headers: { authorization: `Bearer ${apiToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    });
    const payload = (await upstream.json()) as Record<string, unknown>;
    return NextResponse.json(payload, {
      status: upstream.status,
      headers: { 'cache-control': 'private, no-store' }
    });
  } catch {
    return NextResponse.json(
      {
        error:
          'No se pudo conectar con el servidor del bot. Comprueba la URL y que el daemon esté activo.'
      },
      { status: 502 }
    );
  }
}

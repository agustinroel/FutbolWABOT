import { cookies } from 'next/headers';
import type { ReactElement } from 'react';
import { isValidSession, sessionCookieName } from '@/lib/auth';
import { Dashboard } from '@/components/dashboard';
import { LoginForm } from '@/components/login-form';
import type { DashboardData } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function HomePage(): Promise<ReactElement> {
  const cookieStore = await cookies();
  if (!isValidSession(cookieStore.get(sessionCookieName)?.value))
    return <LoginForm />;

  let initialData: DashboardData | null = null;
  let initialError: string | null = null;
  const apiUrl = process.env.BOT_API_URL;
  const apiToken = process.env.BOT_API_TOKEN;

  if (!apiUrl || !apiToken) {
    initialError =
      'Falta configurar BOT_API_URL o BOT_API_TOKEN en el servidor web.';
  } else {
    try {
      const response = await fetch(new URL('/api/dashboard', apiUrl), {
        headers: { authorization: `Bearer ${apiToken}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok)
        throw new Error(
          `El servidor del bot respondió HTTP ${response.status}.`
        );
      initialData = (await response.json()) as DashboardData;
    } catch (error) {
      initialError =
        error instanceof Error
          ? error.message
          : 'El servidor del bot no está disponible.';
    }
  }

  return <Dashboard initialData={initialData} initialError={initialError} />;
}

import type { Metadata, Viewport } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Montemar · Fútbol de los jueves',
  description:
    'Convocatoria, clasificación e historial del grupo de fútbol Montemar.',
  applicationName: 'Montemar Matchday'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#101310'
};

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

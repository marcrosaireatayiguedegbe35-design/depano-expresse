import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { SessionProvider } from '@/components/session';
import { ToastProvider } from '@/components/ui';
import { AuthGate, TabBar } from '@/components/pro';

export const metadata: Metadata = {
  title: { default: 'Depanno Expresse Pro – Espace professionnels', template: '%s · Depanno Expresse Pro' },
  description: 'Recevez des demandes de dépannage près de chez vous, envoyez devis et factures, suivez vos gains.',
  appleWebApp: { capable: true, title: 'Depanno Pro', statusBarStyle: 'default' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#ff7a12' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <SessionProvider>
          <ToastProvider>
            <div className="shell"><AuthGate>{children}</AuthGate></div>
            <TabBar />
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

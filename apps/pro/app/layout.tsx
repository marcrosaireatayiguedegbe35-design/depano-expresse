import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { SessionProvider } from '@/components/session';
import { ToastProvider } from '@/components/ui';
import { AuthGate, TabBar } from '@/components/pro';
import { BrandLoader, RouteLoader } from '@/components/brand-loader';
import { CallRoot } from '@/components/call-root';

export const metadata: Metadata = {
  title: 'Depanno Expresse Professionnel',
  description: 'Recevez des demandes de dépannage près de chez vous, établissez vos factures, suivez vos gains.',
  appleWebApp: { capable: true, title: 'Depanno Expresse Professionnel', statusBarStyle: 'default' },
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
        <BrandLoader logo="/images/brand/embleme-depanno.png" caption="Espace professionnels" />
        <RouteLoader logo="/images/brand/embleme-depanno.png" />
        <SessionProvider>
          <ToastProvider>
            <CallRoot>
            <div className="shell"><AuthGate>{children}</AuthGate></div>
            <TabBar />
            </CallRoot>
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

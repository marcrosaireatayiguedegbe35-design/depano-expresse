import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { CartProvider, FavProvider, PlaceProvider, SessionProvider } from '@/components/session';
import { ToastProvider } from '@/components/ui';
import { PlacePicker, TabBar } from '@/components/chrome';
import { TradesLoader } from '@/components/trades';

export const metadata: Metadata = {
  title: { default: 'Depanno Expresse – Dépannage et services automobiles au Bénin', template: '%s · Depanno Expresse' },
  description: 'Trouvez un professionnel vérifié près de vous : mécanicien, vulcanisateur, électricien auto, remorqueur. Marketplace de pièces et annuaire des entreprises automobiles.',
  appleWebApp: { capable: true, title: 'Depanno Expresse', statusBarStyle: 'default' },
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
          <CartProvider>
            <FavProvider>
              <PlaceProvider>
                <ToastProvider>
                  <TradesLoader>
                    <div className="shell">{children}</div>
                    <TabBar />
                    <PlacePicker />
                  </TradesLoader>
                </ToastProvider>
              </PlaceProvider>
            </FavProvider>
          </CartProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

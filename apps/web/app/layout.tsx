import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { CartProvider, FavProvider, PlaceProvider, SessionProvider, SessionPush } from '@/components/session';
import { ToastProvider } from '@/components/ui';
import { FloatingCart, PlacePicker, TabBar } from '@/components/chrome';
import { TradesLoader } from '@/components/trades';
import { BrandLoader, RouteLoader } from '@/components/brand-loader';
import { CallRoot } from '@/components/call-root';

export const metadata: Metadata = {
  title: 'Depanno Expresse',
  description: 'Trouvez un professionnel vérifié près de vous : mécanicien, vulcanisateur, électricien auto, remorqueur. Marketplace de pièces et annuaire des entreprises automobiles.',
  manifest: '/manifest.webmanifest',
  icons: { apple: '/images/push/icone-192.png' },
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
        <BrandLoader logo="/images/brand/embleme-depanno.png" caption="Dépannage · Mécanique · Assistance 24/7" />
        <RouteLoader logo="/images/brand/embleme-depanno.png" />
        <SessionProvider>
          <CartProvider>
            <FavProvider>
              <PlaceProvider>
                <ToastProvider>
                  <CallRoot>
                  <TradesLoader>
                    <div className="shell">{children}</div>
                    <FloatingCart />
                    <TabBar />
                    <SessionPush />
                    <PlacePicker />
                  </TradesLoader>
                  </CallRoot>
                </ToastProvider>
              </PlaceProvider>
            </FavProvider>
          </CartProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

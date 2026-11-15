import type { Metadata } from 'next';
import './canaan.css';
import './globals.css';
import { ToastProvider } from '@/components/ui';
import { BrandLoader, RouteLoader } from '@/components/brand-loader';

export const metadata: Metadata = {
  title: 'Depanno Expresse Back-office',
  icons: { icon: '/brand/embleme-depanno.png' },
  description: 'Administration de la plateforme de services automobiles',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      
      <body>
        <BrandLoader logo="/brand/embleme-depanno.png" caption="Administration" label="Chargement du back-office" />
        <RouteLoader logo="/brand/embleme-depanno.png" />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

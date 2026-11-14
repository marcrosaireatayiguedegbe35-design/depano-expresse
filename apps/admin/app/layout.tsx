import type { Metadata } from 'next';
import './canaan.css';
import './globals.css';
import { ToastProvider } from '@/components/ui';
import { BrandLoader } from '@/components/brand-loader';

export const metadata: Metadata = {
  title: 'Back-office – Depanno Expresse',
  icons: { icon: '/brand/embleme-depanno.png' },
  description: 'Administration de la plateforme de services automobiles',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <BrandLoader logo="/brand/logo-depanno-expresse.png" caption="Administration" label="Chargement du back-office" />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

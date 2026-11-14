'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '@/components/session';
import { Loading } from '@/components/ui';

/** Les sous-pages du compte exigent une connexion ; la page « Profil » gère elle-même l'état déconnecté. */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const needsAuth = pathname !== '/compte';
  useEffect(() => {
    if (needsAuth && !loading && !user) router.replace(`/connexion?next=${encodeURIComponent(pathname)}`);
  }, [needsAuth, loading, user, router, pathname]);
  if (needsAuth && !user) return <div className="screen"><Loading /></div>;
  return needsAuth ? <div className="screen"><div className="blob blob-soft" aria-hidden />{children}</div> : <>{children}</>;
}

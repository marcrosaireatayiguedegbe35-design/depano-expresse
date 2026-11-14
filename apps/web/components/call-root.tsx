'use client';

import { ReactNode } from 'react';
import { CallProvider } from './calls';
import { useSession } from './session';

/** Active les appels dans le site pour un client connecté. */
export function CallRoot({ children }: { children: ReactNode }) {
  const { user } = useSession();
  return <CallProvider enabled={!!user}>{children}</CallProvider>;
}

'use client';

import { ReactNode } from 'react';
import { CallProvider } from './calls';
import { useSession } from './session';

/** Active les appels dans le site pour un professionnel connecté. */
export function CallRoot({ children }: { children: ReactNode }) {
  const { pro } = useSession();
  return <CallProvider enabled={!!pro}>{children}</CallProvider>;
}

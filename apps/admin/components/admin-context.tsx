'use client';

import { createContext, useContext } from 'react';

export interface Me {
  id: string;
  email: string;
  name: string;
  role: string;
  roleLabel: string;
  permissions: string[];
  mustChangePassword: boolean;
}

export const AdminCtx = createContext<Me | null>(null);
export const useMe = () => useContext(AdminCtx)!;
export const useCan = () => {
  const me = useContext(AdminCtx);
  return (perm: string) => !!me?.permissions.includes(perm);
};

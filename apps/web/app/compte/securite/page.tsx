'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from '@/components/icons';
import { PageHead } from '@/components/ds';
import { DeleteAccount } from '@/components/delete-account';
import { useSession } from '@/components/session';
import { ErrorBox, PasswordInput, useToast } from '@/components/ui';

/** Sécurité : changement de mot de passe et suppression du compte. */
export default function SecurityPage() {
  const toast = useToast();
  const { refresh } = useSession();
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <PageHead title="Sécurité" back="/compte" />
      <form onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try { await api('/auth/password', { method: 'POST', body: f }); setF({ currentPassword: '', newPassword: '' }); toast('Mot de passe modifié'); } catch (err: any) { setError(err.message); }
      }}>
        <div className="fcard indent"><div className="fcard-head"><Icon name="lock" /><label htmlFor="cp">Mot de passe actuel</label></div><PasswordInput id="cp" value={f.currentPassword} onChange={(v) => setF({ ...f, currentPassword: v })} blue /></div>
        <div className="fcard indent"><div className="fcard-head"><Icon name="lockFill" /><label htmlFor="np">Nouveau mot de passe</label></div><PasswordInput id="np" value={f.newPassword} onChange={(v) => setF({ ...f, newPassword: v })} autoComplete="new-password" minLength={8} placeholder="8 caractères, une lettre et un chiffre" blue /></div>
        <ErrorBox error={error} />
        <button className="btn btn-primary btn-block">Mettre à jour le mot de passe</button>
      </form>
      <DeleteAccount onDeleted={() => { refresh(); }} />
    </>
  );
}

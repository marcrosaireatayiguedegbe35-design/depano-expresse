'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from '@/components/icons';
import { Blob, PageHead } from '@/components/ds';
import { ErrorBox, PasswordInput, useToast } from '@/components/ui';
import { DeleteAccount } from '@/components/delete-account';
import { useSession } from '@/components/session';

export default function SecurityPage() {
  const toast = useToast();
  const { refresh } = useSession();
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="screen">
      <Blob soft />
      <PageHead title="Sécurité" back="/profil" />
    <form onSubmit={async (e) => {
      e.preventDefault();
      setErr(null);
      try { await api('/auth/password', { method: 'POST', body: f }); setF({ currentPassword: '', newPassword: '' }); toast('Mot de passe modifié – vos autres sessions sont déconnectées'); }
      catch (e2: any) { setErr(e2.message); }
    }}>
      <div className="fcard indent"><div className="fcard-head"><Icon name="lock" /><label htmlFor="cp">Mot de passe actuel</label></div><PasswordInput id="cp" value={f.currentPassword} onChange={(v) => setF({ ...f, currentPassword: v })} blue /></div>
      <div className="fcard indent"><div className="fcard-head"><Icon name="lockFill" /><label htmlFor="np">Nouveau mot de passe</label></div><PasswordInput id="np" value={f.newPassword} onChange={(v) => setF({ ...f, newPassword: v })} autoComplete="new-password" minLength={8} placeholder="8 caractères, une lettre et un chiffre" blue /></div>
      <ErrorBox error={err} />
      <button className="btn btn-primary btn-block">Mettre à jour</button>
    </form>
    <DeleteAccount who="pro" redirect="/connexion" onDeleted={() => { refresh(); }} />
    </div>
  );
}

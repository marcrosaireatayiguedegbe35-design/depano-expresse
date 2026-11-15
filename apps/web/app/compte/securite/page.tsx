'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from '@/components/icons';
import { PageHead } from '@/components/ds';
import { DeleteAccount } from '@/components/delete-account';
import { useSession } from '@/components/session';
import { ErrorBox, PasswordInput, useToast } from '@/components/ui';

/** Sécurité : changement de mot de passe, puis zone de suppression du compte, bien séparée. */
export default function SecurityPage() {
  const toast = useToast();
  const { user, refresh } = useSession();
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const strong = f.newPassword.length >= 8 && /[a-z]/i.test(f.newPassword) && /\d/.test(f.newPassword);

  return (
    <div className="pf">
      <PageHead title="Sécurité" back="/compte" />

      <section className="pf-id slim">
        <span className="pf-avatar"><Icon name="shieldFill" /></span>
        <span className="grow"><b>Protégez votre compte</b><small><Icon name="mail" />{user?.email}</small></span>
      </section>

      <form className="pf-card" onSubmit={async (e) => {
        e.preventDefault();
        setError(null); setBusy(true);
        try { await api('/auth/password', { method: 'POST', body: f }); setF({ currentPassword: '', newPassword: '' }); toast('Mot de passe modifié'); }
        catch (err: any) { setError(err.message); }
        finally { setBusy(false); }
      }}>
        <h2><Icon name="lock" />Changer le mot de passe</h2>
        <div className="field"><label htmlFor="cp">Mot de passe actuel</label><PasswordInput id="cp" value={f.currentPassword} onChange={(v) => setF({ ...f, currentPassword: v })} /></div>
        <div className="field"><label htmlFor="np">Nouveau mot de passe</label><PasswordInput id="np" value={f.newPassword} onChange={(v) => setF({ ...f, newPassword: v })} autoComplete="new-password" minLength={8} placeholder="Nouveau mot de passe" /></div>
        <p className={`pf-rule${strong ? ' ok' : ''}`}><Icon name={strong ? 'checkCircle' : 'infoOutline'} />Au moins 8 caractères, avec une lettre et un chiffre.</p>
        <ErrorBox error={error} />
        <button className="btn btn-primary btn-block" disabled={busy || !f.currentPassword || !strong}>{busy ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}</button>
      </form>

      <DeleteAccount onDeleted={() => { refresh(); }} />
    </div>
  );
}

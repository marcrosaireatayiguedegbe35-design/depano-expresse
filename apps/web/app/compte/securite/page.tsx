'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { PageTitle } from '@/components/chrome';
import { useSession } from '@/components/session';
import { ErrorBox, PasswordInput, useToast } from '@/components/ui';

export default function SecurityPage() {
  const toast = useToast();
  const router = useRouter();
  const { logout } = useSession();
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });
  const [error, setError] = useState<string | null>(null);
  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <PageTitle title="Sécurité & paramètres" back="/compte" />
      <form onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try { await api('/auth/password', { method: 'POST', body: f }); setF({ currentPassword: '', newPassword: '' }); toast('Mot de passe modifié'); } catch (err: any) { setError(err.message); }
      }}>
        <h2 className="mb">Changer mon mot de passe</h2>
        <div className="field"><label htmlFor="cp">Mot de passe actuel</label><PasswordInput id="cp" value={f.currentPassword} onChange={(v) => setF({ ...f, currentPassword: v })} /></div>
        <div className="field"><label htmlFor="np">Nouveau mot de passe</label><PasswordInput id="np" value={f.newPassword} onChange={(v) => setF({ ...f, newPassword: v })} autoComplete="new-password" minLength={8} placeholder="8 caractères, une lettre et un chiffre" /></div>
        <ErrorBox error={error} />
        <button className="btn btn-primary btn-block">Mettre à jour</button>
      </form>
      <div className="card mt" style={{ boxShadow: 'none', background: 'var(--soft)' }}>
        <h3>Mes données</h3>
        <p className="small muted" style={{ margin: '6px 0 12px' }}>Vous pouvez demander la suppression de votre compte et de vos données personnelles. Notre équipe traitera la demande.</p>
        <button className="btn btn-sm btn-danger" onClick={async () => {
          if (!confirm('Demander la suppression de votre compte ? Vous serez déconnecté.')) return;
          await api('/auth/me', { method: 'DELETE' });
          await logout();
          router.push('/bienvenue');
        }}>Demander la suppression de mon compte</button>
      </div>
    </div>
  );
}

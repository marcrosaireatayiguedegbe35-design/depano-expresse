'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useMe } from '@/components/admin-context';
import { Card, ErrorBox, KV, PageHeader, Table, useFetch, useToast } from '@/components/ui';

export default function AccountPage() {
  const me = useMe();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '', code: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sessions = useFetch<any[]>(me.mustChangePassword ? null : '/auth/sessions');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return setError('Les deux mots de passe ne correspondent pas');
    setBusy(true);
    setError(null);
    try {
      await api('/auth/password', { method: 'POST', body: { currentPassword: form.currentPassword, newPassword: form.newPassword, code: form.code } });
      toast('Mot de passe modifié. Vos autres sessions ont été fermées.');
      setForm({ currentPassword: '', newPassword: '', confirm: '', code: '' });
      if (me.mustChangePassword) window.location.href = '/';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    await api(`/auth/sessions/${id}`, { method: 'DELETE' });
    sessions.reload();
  };

  return (
    <>
      <PageHeader title="Mon compte" />
      {me.mustChangePassword && (
        <div className="alert alert-warning">Première connexion : choisissez un nouveau mot de passe personnel pour accéder au back-office.</div>
      )}
      <div className="grid grid-2">
        <Card title="Profil">
          <KV items={[['Nom', me.name], ['E-mail', me.email], ['Rôle', me.roleLabel], ['Permissions', `${me.permissions.length} accordées`]]} />
        </Card>
        <Card title="Changer mon mot de passe">
          <form onSubmit={submit}>
            {(['currentPassword', 'newPassword', 'confirm'] as const).map((k) => (
              <div className="field" key={k}>
                <label htmlFor={k}>{{ currentPassword: 'Mot de passe actuel', newPassword: 'Nouveau mot de passe', confirm: 'Confirmation' }[k]}</label>
                <input id={k} type="password" required autoComplete={k === 'currentPassword' ? 'current-password' : 'new-password'}
                  value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
            <small className="muted">12 caractères minimum, avec majuscule, minuscule, chiffre et symbole.</small>
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="code">Code de vérification <button type="button" className="btn btn-sm" style={{ marginLeft: 8 }} onClick={async () => {
                try { const r = await api('/auth/code', { method: 'POST' }); toast(r.channel === 'email' ? `Code envoyé à ${r.emailHint}` : 'Utilisez votre application d’authentification'); }
                catch (err: any) { setError(err.message); }
              }}>Recevoir le code par e-mail</button></label>
              <input id="code" inputMode="numeric" maxLength={6} required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })} />
            </div>
            <ErrorBox error={error} />
            <button className="btn btn-primary" disabled={busy}>Mettre à jour</button>
          </form>
        </Card>
      </div>
      {!me.mustChangePassword && (
        <Card title="Mes sessions actives">
          <Table
            rows={sessions.data ?? undefined}
            columns={[
              { key: 'ip', label: 'Adresse IP', render: (s: any) => <span className="mono">{s.ip}</span> },
              { key: 'userAgent', label: 'Navigateur', render: (s: any) => <span className="small">{s.userAgent?.slice(0, 80)}</span> },
              { key: 'lastSeenAt', label: 'Dernière activité', render: (s: any) => dateTime(s.lastSeenAt) },
              { key: 'expiresAt', label: 'Expire', render: (s: any) => dateTime(s.expiresAt) },
              {
                key: 'a', label: '', render: (s: any) =>
                  s.current ? <span className="badge badge-success">Cette session</span> : <button className="btn btn-sm" onClick={() => revoke(s._id)}>Révoquer</button>,
              },
            ]}
          />
        </Card>
      )}
    </>
  );
}

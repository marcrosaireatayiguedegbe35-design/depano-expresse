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
      await api('/auth/password', { method: 'POST', body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      toast('Mot de passe modifié. Vos autres sessions ont été fermées.');
      setForm({ currentPassword: '', newPassword: '', confirm: '', code: '' });
      if (me.mustChangePassword) window.location.href = '/';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const [delPw, setDelPw] = useState('');
  const [delConfirm, setDelConfirm] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleting(true); setDelError(null);
    try {
      await api('/auth/me', { method: 'DELETE', body: { password: delPw } });
      window.location.href = '/login';
    } catch (err: any) { setDelError(err.message); setDeleting(false); }
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
      <Card title="Supprimer mon compte">
        <p className="muted small" style={{ marginTop: 0 }}>Votre compte administrateur sera supprimé définitivement et vous serez déconnecté. Les actions déjà enregistrées dans le journal d’activité sont conservées. Le dernier super administrateur actif ne peut pas supprimer son compte.</p>
        <form onSubmit={deleteAccount} style={{ maxWidth: 420 }}>
          <div className="field"><label htmlFor="delpw">Confirmez avec votre mot de passe</label><input id="delpw" type="password" autoComplete="current-password" required value={delPw} onChange={(e) => setDelPw(e.target.value)} /></div>
          <label className="check" style={{ margin: '6px 0 10px' }}><input type="checkbox" checked={delConfirm} onChange={(e) => setDelConfirm(e.target.checked)} /> Je comprends que cette action est irréversible.</label>
          <ErrorBox error={delError} />
          <button className="btn btn-danger" disabled={deleting || !delConfirm || !delPw}>{deleting ? 'Suppression…' : 'Supprimer mon compte'}</button>
        </form>
      </Card>
    </>
  );
}

'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { COMMUNES } from '@/lib/format';
import { PageTitle } from '@/components/chrome';
import { useSession } from '@/components/session';
import { ErrorBox, useToast } from '@/components/ui';

export default function ProfilePage() {
  const { user, refresh } = useSession();
  const toast = useToast();
  const [f, setF] = useState({ firstName: user!.firstName, lastName: user!.lastName, phone: user!.phone ?? '', commune: user!.commune ?? '', quartier: user!.quartier ?? '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        await api('/auth/me', { method: 'PATCH', body: { ...f, phone: f.phone.replace(/\s/g, '') || undefined, commune: f.commune || undefined, quartier: f.quartier || undefined } });
        await refresh();
        toast('Profil mis à jour');
      } catch (err: any) { setError(err.message); } finally { setBusy(false); }
    }} style={{ maxWidth: 520, margin: '0 auto' }}>
      <PageTitle title="Mon profil" back="/compte" />
      <div className="profile-head"><span className="avatar">{`${f.firstName[0] ?? ''}${f.lastName[0] ?? ''}`.toUpperCase()}</span><p className="muted small">{user!.email}</p></div>
      <div className="form-grid">
        <div className="field"><label htmlFor="fn">Prénom</label><input id="fn" required value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></div>
        <div className="field"><label htmlFor="ln">Nom</label><input id="ln" required value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></div>
      </div>
      <div className="field"><label htmlFor="ph">Téléphone</label><input id="ph" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+229 01 XX XX XX XX" /></div>
      <div className="form-grid">
        <div className="field"><label htmlFor="co">Commune</label><select id="co" value={f.commune} onChange={(e) => setF({ ...f, commune: e.target.value })}><option value="">—</option>{COMMUNES.map((c) => <option key={c.name}>{c.name}</option>)}</select></div>
        <div className="field"><label htmlFor="qu">Quartier</label><input id="qu" value={f.quartier} onChange={(e) => setF({ ...f, quartier: e.target.value })} /></div>
      </div>
      <ErrorBox error={error} />
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
    </form>
  );
}

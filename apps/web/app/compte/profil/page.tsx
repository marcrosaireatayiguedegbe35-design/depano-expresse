'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { COMMUNES } from '@/lib/format';
import { PageHead } from '@/components/ds';
import { Icon } from '@/components/icons';
import { useSession } from '@/components/session';
import { ErrorBox, useToast } from '@/components/ui';

/** Mon profil : carte d'identité du compte, puis coordonnées regroupées par thème. */
export default function ProfilePage() {
  const { user, refresh } = useSession();
  const toast = useToast();
  const [f, setF] = useState({ firstName: user!.firstName, lastName: user!.lastName, phone: user!.phone ?? '', commune: user!.commune ?? '', quartier: user!.quartier ?? '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const initials = `${f.firstName[0] ?? ''}${f.lastName[0] ?? ''}`.toUpperCase() || '?';

  return (
    <form className="pf" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        await api('/auth/me', { method: 'PATCH', body: { ...f, phone: f.phone.replace(/\s/g, '') || undefined, commune: f.commune || undefined, quartier: f.quartier || undefined } });
        await refresh();
        toast('Profil mis à jour');
      } catch (err: any) { setError(err.message); } finally { setBusy(false); }
    }}>
      <PageHead title="Mon profil" back="/compte" />

      <section className="pf-id">
        <span className="pf-avatar">{initials}</span>
        <span className="grow">
          <b>{`${f.firstName} ${f.lastName}`.trim() || 'Mon compte'}</b>
          <small><Icon name="mail" />{user!.email}</small>
        </span>
      </section>

      <section className="pf-card">
        <h2><Icon name="user" />Identité</h2>
        <div className="field"><label htmlFor="fn">Prénom</label><input id="fn" required value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} autoComplete="given-name" /></div>
        <div className="field"><label htmlFor="ln">Nom</label><input id="ln" required value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} autoComplete="family-name" /></div>
      </section>

      <section className="pf-card">
        <h2><Icon name="phone" />Contact</h2>
        <div className="field"><label htmlFor="ph">Téléphone</label><input id="ph" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+229 01 XX XX XX XX" autoComplete="tel" /></div>
        <p className="pf-hint">Le professionnel qui accepte votre demande vous joint à ce numéro.</p>
      </section>

      <section className="pf-card">
        <h2><Icon name="pin" />Adresse</h2>
        <div className="pf-row">
          <div className="field"><label htmlFor="co">Commune</label><select id="co" value={f.commune} onChange={(e) => setF({ ...f, commune: e.target.value })}><option value="">Choisir…</option>{COMMUNES.map((c) => <option key={c.name}>{c.name}</option>)}</select></div>
          <div className="field"><label htmlFor="qu">Quartier</label><input id="qu" value={f.quartier} onChange={(e) => setF({ ...f, quartier: e.target.value })} placeholder="Ex. Cadjèhoun" /></div>
        </div>
      </section>

      <ErrorBox error={error} />
      <button className="btn btn-primary btn-block pf-save" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer les modifications'}</button>
    </form>
  );
}

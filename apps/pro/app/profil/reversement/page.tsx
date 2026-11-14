'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from '@/components/icons';
import { Blob, PageHead } from '@/components/ds';
import { useSession } from '@/components/session';
import { ErrorBox, useToast } from '@/components/ui';

const OPS: [string, string][] = [['mtn', 'MTN MoMo'], ['moov', 'Moov Money'], ['celtiis', 'Celtiis Cash']];

/** Compte Mobile Money sur lequel la plateforme reverse la part nette du professionnel. */
export default function PayoutAccountPage() {
  const { pro, setPro } = useSession();
  const toast = useToast();
  const [f, setF] = useState({ operator: pro?.payoutAccount?.operator ?? 'mtn', msisdn: (pro?.payoutAccount?.msisdn ?? '').replace(/^\+229/, ''), holderName: pro?.payoutAccount?.holderName ?? `${pro?.firstName ?? ''} ${pro?.lastName ?? ''}`.trim() });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!pro) return null;
  return (
    <form className="screen" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setErr(null);
      try {
        const r = await api('/auth/me', { method: 'PATCH', body: { payoutAccount: { operator: f.operator, msisdn: `+229${f.msisdn.replace(/\D/g, '')}`, holderName: f.holderName } } });
        setPro({ ...pro, ...r });
        toast('Compte de reversement enregistré');
      } catch (e2: any) { setErr(e2.message); } finally { setBusy(false); }
    }}>
      <Blob soft />
      <PageHead title="Reversements" back="/profil" />
      <p className="text-2 small" style={{ marginBottom: 14 }}>Après chaque paiement client, votre part nette (montant payé moins la commission sur les prestations) vous est reversée sur ce compte.</p>
      <div className="fcard indent"><div className="fcard-head"><Icon name="cardFill" /><label>Opérateur</label></div>
        <div className="tags" style={{ marginLeft: 34 }}>{OPS.map(([v, l]) => <button type="button" key={v} className={`opt${f.operator === v ? ' on' : ''}`} onClick={() => setF({ ...f, operator: v })}>{l}</button>)}</div></div>
      <div className="fcard indent"><div className="fcard-head"><Icon name="phoneFill" /><label htmlFor="ms">Numéro Mobile Money</label></div>
        <div className="frow"><select className="cc" aria-label="Indicatif" defaultValue="+229"><option>+229</option></select><input id="ms" type="tel" required pattern="[0-9 ]{8,14}" placeholder="01 XX XX XX XX" value={f.msisdn} onChange={(e) => setF({ ...f, msisdn: e.target.value })} /></div></div>
      <div className="fcard indent"><div className="fcard-head"><Icon name="userFill" /><label htmlFor="hn">Titulaire du compte</label></div>
        <div className="finput blue"><input id="hn" required minLength={2} value={f.holderName} onChange={(e) => setF({ ...f, holderName: e.target.value })} /></div></div>
      <ErrorBox error={err} />
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
    </form>
  );
}

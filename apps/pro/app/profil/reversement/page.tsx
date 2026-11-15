'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from '@/components/icons';
import { BackButton } from '@/components/ds';
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
  const saved = pro.payoutAccount?.msisdn;
  const opLabel = (v?: string) => OPS.find(([k]) => k === v)?.[1] ?? v;

  return (
    <form className="screen pg" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setErr(null);
      try {
        const r = await api('/auth/me', { method: 'PATCH', body: { payoutAccount: { operator: f.operator, msisdn: `+229${f.msisdn.replace(/\D/g, '')}`, holderName: f.holderName } } });
        setPro({ ...pro, ...r });
        toast('Compte de reversement enregistré');
      } catch (e2: any) { setErr(e2.message); } finally { setBusy(false); }
    }}>
      <header className="pg-head"><BackButton href="/profil" /><div><h1>Reversements</h1><p>Où recevoir votre part nette</p></div></header>

      <section className={`rv-cardx${saved ? '' : ' empty'}`}>
        <span className="rv-chip"><Icon name="cardFill" />Mobile Money</span>
        {saved ? <>
          <strong>{pro.payoutAccount!.msisdn}</strong>
          <div className="rv-meta"><span><small>Opérateur</small><b>{opLabel(pro.payoutAccount!.operator)}</b></span><span><small>Titulaire</small><b>{pro.payoutAccount!.holderName}</b></span></div>
        </> : <><strong>Aucun compte</strong><p>Ajoutez votre numéro pour recevoir vos gains.</p></>}
      </section>

      <ol className="rv-how">
        <li><span>1</span>Le client paie la facture</li>
        <li><span>2</span>La commission est déduite</li>
        <li><span>3</span>Votre part arrive sur ce numéro</li>
      </ol>

      <section className="pg-card">
        <h2><Icon name="settings" />{saved ? 'Modifier le compte' : 'Ajouter un compte'}</h2>
        <p className="pg-label">Opérateur</p>
        <div className="rv-ops">{OPS.map(([v, l]) => <button type="button" key={v} className={`rv-op ${v}${f.operator === v ? ' on' : ''}`} onClick={() => setF({ ...f, operator: v })} aria-pressed={f.operator === v}><i />{l}</button>)}</div>
        <label className="pg-label" htmlFor="ms">Numéro Mobile Money</label>
        <div className="rv-phone"><span>+229</span><input id="ms" type="tel" required pattern="[0-9 ]{8,14}" placeholder="01 XX XX XX XX" value={f.msisdn} onChange={(e) => setF({ ...f, msisdn: e.target.value })} /></div>
        <label className="pg-label" htmlFor="hn">Titulaire du compte</label>
        <input className="rv-input" id="hn" required minLength={2} value={f.holderName} onChange={(e) => setF({ ...f, holderName: e.target.value })} />
        <p className="pg-hint">Le nom doit correspondre à celui du compte Mobile Money.</p>
        <ErrorBox error={err} />
        <button className="btn btn-primary btn-block" disabled={busy} style={{ marginBottom: 14 }}>{busy ? 'Enregistrement…' : 'Enregistrer le compte'}</button>
      </section>
    </form>
  );
}

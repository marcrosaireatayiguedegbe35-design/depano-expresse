'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { date } from '@/lib/format';
import { Icon } from '@/components/icons';
import { Blob, PageHead } from '@/components/ds';
import { uploadImage, VerificationBanner } from '@/components/pro';
import { useSession } from '@/components/session';
import { ErrorBox, Loading, useFetch, useToast } from '@/components/ui';

interface Item {
  key: string; label: string; hint: string; required: boolean;
  status: 'missing' | 'pending' | 'accepted' | 'rejected' | 'expired';
  href?: string; number?: string; expiry?: boolean; issuedMaxDays?: number; doc?: any;
}

const ST: Record<Item['status'], [string, string]> = {
  missing: ['À fournir', 'todo'], pending: ['En vérification', 'warning'], accepted: ['Accepté', 'success'],
  rejected: ['Refusé', 'danger'], expired: ['Expiré', 'danger'],
};
const today = () => new Date().toISOString().slice(0, 10);

/** Dépôt d'une pièce : numéro et dates demandés selon le type, puis photo. */
function Upload({ item, onDone }: { item: Item; onDone: () => void }) {
  const toast = useToast();
  const [number, setNumber] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ready = (!item.number || number.trim().length >= 3) && (!item.expiry || !!expiresAt) && (!item.issuedMaxDays || !!issuedAt);
  return (
    <div className="dc-up">
      {item.number && <div className="finput"><input aria-label={item.number} placeholder={item.number} maxLength={40} value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} /></div>}
      {item.expiry && <label className="dc-date"><span>Date d’expiration</span><input type="date" min={today()} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></label>}
      {item.issuedMaxDays && <label className="dc-date"><span>Date de délivrance</span><input type="date" max={today()} value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} /></label>}
      <label className={`btn btn-primary btn-block btn-md${!ready || busy ? ' is-off' : ''}`} aria-disabled={!ready || busy}>
        {busy ? 'Envoi…' : <><Icon name="plus" />{ready ? 'Photographier ou choisir la photo' : 'Complétez les champs ci-dessus'}</>}
        <input type="file" accept="image/*" capture="environment" hidden disabled={!ready || busy} onChange={async (e) => {
          const file = e.target.files?.[0]; e.target.value = '';
          if (!file) return;
          setBusy(true); setErr(null);
          try {
            const url = await uploadImage(file, 'documents');
            await api('/documents', { method: 'POST', body: { type: item.key, url, number: number.trim() || undefined, expiresAt: expiresAt || undefined, issuedAt: issuedAt || undefined } });
            toast('Pièce envoyée pour vérification');
            onDone();
          } catch (e2: any) { setErr(e2.message); } finally { setBusy(false); }
        }} />
      </label>
      <ErrorBox error={err} />
    </div>
  );
}

function Row({ item, open, onToggle, onDone }: { item: Item; open: boolean; onToggle: () => void; onDone: () => void }) {
  const [label, cls] = ST[item.status];
  const d = item.doc;
  const body = (
    <>
      <span className={`dc-ic ${cls}`}>{d?.url ? <img src={d.url} alt="" /> : <Icon name={item.status === 'accepted' ? 'check' : item.href ? 'arrow' : 'doc'} />}</span>
      <span className="grow">
        <b>{item.label}</b>
        <small>{item.href && item.status === 'accepted' ? (item.key === 'contract' ? 'Signé · voir et télécharger le PDF' : 'Renseigné') : item.status === 'missing' || item.href ? item.hint : [d?.number && `N° ${d.number}`, d?.expiresAt && `expire le ${date(d.expiresAt)}`, d && `déposé le ${date(d.createdAt)}`].filter(Boolean).join(' · ')}</small>
        {item.status === 'rejected' && d?.rejectReason && <small className="dc-why">Motif : {d.rejectReason}</small>}
      </span>
      <span className={`badge-s ${cls}`}>{label}</span>
    </>
  );
  if (item.href) return <Link href={item.status === 'accepted' && item.key === 'contract' ? '/contrat' : item.href} className="dc-row">{body}</Link>;
  return (
    <div className={`dc-item${open ? ' dc-open' : ''}`}>
      <button type="button" className="dc-row" onClick={onToggle} aria-expanded={open}>{body}</button>
      {open && (
        <div className="dc-more">
          {item.status !== 'missing' && <p className="xs text-2">{item.hint}</p>}
          {d?.url && <a className="dc-see" href={d.url} target="_blank" rel="noopener noreferrer">Voir la photo déposée</a>}
          <Upload item={item} onDone={onDone} />
        </div>
      )}
    </div>
  );
}

/** Pièces exigées pour la validation du compte, avec l'état de chacune et le dépôt photo. */
export default function DocumentsPage() {
  const { refresh } = useSession();
  const { data, error, reload } = useFetch<any>('/documents/checklist');
  const [open, setOpen] = useState<string | null>(null);
  const done = () => { setOpen(null); reload(); refresh(); };

  const items: Item[] = data?.items ?? [];
  const steps = items.filter((i) => i.href);
  const required = items.filter((i) => i.required && !i.href);
  const optional = items.filter((i) => !i.required && !i.href);
  const other: Item = { key: 'other', label: 'Autre document', hint: 'Tout autre justificatif utile à votre vérification.', required: false, status: 'missing' };
  const pct = data ? Math.round((data.provided / data.requiredCount) * 100) : 0;

  return (
    <div className="screen">
      <Blob soft />
      <PageHead title="Documents" back="/profil" />
      <VerificationBanner />
      {error ? <ErrorBox error={error} /> : !data ? <Loading rows={3} height={70} /> : (
        <>
          <section className="section dc-progress">
            <div className="dc-ptop"><b>{data.provided} / {data.requiredCount} éléments obligatoires fournis</b><span>{pct} %</span></div>
            <div className="dc-bar"><i style={{ width: `${pct}%` }} /></div>
            <p className="xs text-2">{data.complete ? 'Tout est accepté : votre compte peut être validé.' : 'Votre compte sera validé quand tous les éléments obligatoires seront acceptés par notre équipe. Photos nettes, en entier, sans reflet (5 Mo max).'}</p>
          </section>

          <h2 className="dc-h">Étapes obligatoires</h2>
          <div className="dc-list">{steps.map((i) => <Row key={i.key} item={i} open={false} onToggle={() => {}} onDone={done} />)}</div>

          <h2 className="dc-h">Pièces obligatoires</h2>
          <div className="dc-list">{required.map((i) => <Row key={i.key} item={i} open={open === i.key} onToggle={() => setOpen(open === i.key ? null : i.key)} onDone={done} />)}</div>

          <h2 className="dc-h">Facultatif<small>Diplôme ou assurance acceptés : badge « Qualifié »</small></h2>
          <div className="dc-list">
            {optional.map((i) => <Row key={i.key} item={i} open={open === i.key} onToggle={() => setOpen(open === i.key ? null : i.key)} onDone={done} />)}
            <Row item={other} open={open === 'other'} onToggle={() => setOpen(open === 'other' ? null : 'other')} onDone={done} />
          </div>
          <p className="xs text-2 center" style={{ marginTop: 14 }}>Vos documents ne sont visibles que par l’équipe de vérification.</p>
        </>
      )}
    </div>
  );
}

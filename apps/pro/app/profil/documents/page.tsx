'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { date } from '@/lib/format';
import { Icon } from '@/components/icons';
import { Blob, PageHead } from '@/components/ds';
import { uploadImage, VerificationBanner } from '@/components/pro';
import { useSession } from '@/components/session';
import { Empty, ErrorBox, Loading, useFetch, useToast } from '@/components/ui';

const TYPES: [string, string][] = [['id_card', 'Pièce d’identité'], ['business_registration', 'Registre de commerce / IFU'], ['certificate', 'Certificat / diplôme'], ['other', 'Autre document']];
const ST: Record<string, [string, string]> = { pending: ['En vérification', 'warning'], accepted: ['Accepté', 'success'], rejected: ['Refusé', 'danger'] };

/** Dépôt des documents de vérification (photos), examinés par l'administration. */
export default function DocumentsPage() {
  const { refresh } = useSession();
  const { data, reload } = useFetch<any[]>('/documents');
  const toast = useToast();
  const [type, setType] = useState('id_card');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="screen">
      <Blob soft />
      <PageHead title="Documents" back="/profil" />
      <VerificationBanner />
      <section className="section fcard">
        <div className="fcard-head"><Icon name="shieldFill" /><label htmlFor="ty">Ajouter un document</label></div>
        <div className="finput"><select id="ty" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <label className="btn btn-primary btn-block" style={{ marginTop: 12 }}>{busy ? 'Envoi…' : <><Icon name="plus" />Photographier ou choisir le document</>}
          <input type="file" accept="image/*" capture="environment" hidden disabled={busy} onChange={async (e) => {
            const file = e.target.files?.[0]; e.target.value = '';
            if (!file) return;
            setBusy(true); setErr(null);
            try {
              const url = await uploadImage(file, 'documents');
              await api('/documents', { method: 'POST', body: { type, label: TYPES.find((t) => t[0] === type)?.[1], url } });
              toast('Document envoyé pour vérification');
              reload(); refresh();
            } catch (e2: any) { setErr(e2.message); } finally { setBusy(false); }
          }} /></label>
        <p className="xs text-2" style={{ marginTop: 8 }}>Formats image (photo nette, 5 Mo max). Vos documents ne sont visibles que par l’équipe de vérification.</p>
        <ErrorBox error={err} />
      </section>
      <section className="section stack" style={{ gap: 10 }}>
        {!data ? <Loading rows={2} height={70} /> : data.length === 0 ? <Empty icon="docFill" title="Aucun document déposé" /> : data.map((d) => (
          <div key={d._id} className="money-row">
            <a href={d.url} target="_blank" rel="noopener noreferrer" className="ic" style={{ overflow: 'hidden', padding: 0 }}><img src={d.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></a>
            <span><b>{d.label}</b><small>Déposé le {date(d.createdAt)}</small></span>
            <span className="amt"><span className={`badge-s ${ST[d.status]?.[1]}`}>{ST[d.status]?.[0]}</span></span>
          </div>
        ))}
      </section>
    </div>
  );
}

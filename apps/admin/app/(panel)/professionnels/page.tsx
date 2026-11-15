'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Badge, ErrorBox, Filters, Modal, PageHeader, Pager, Table, useList } from '@/components/ui';
import { qs } from '@/lib/api';
import { date, personName, STATUS, TRADES } from '@/lib/format';

const V_STATUSES = ['pending', 'in_review', 'validated', 'rejected', 'suspended'];

function List() {
  const router = useRouter();
  const sp = useSearchParams();
  const { data, error, params, set, setPage } = useList('/professionals', { status: sp.get('status') ?? '' });
  const [exp, setExp] = useState<{ status: string; trade: string; availability: string } | null>(null);
  const openExport = () => setExp({ status: String(params.status ?? '') || 'validated', trade: String(params.trade ?? ''), availability: '' });
  return (
    <>
      <PageHeader title="Professionnels" subtitle="Vérification des comptes : seuls les comptes validés reçoivent des demandes." actions={<button className="btn btn-primary" onClick={openExport}>Exporter en PDF</button>} />
      <Filters
        params={params} set={set} search="Nom, téléphone, commune…"
        selects={[
          { key: 'status', label: 'Vérification', options: V_STATUSES.map((s) => [s, STATUS[s][0]]) },
          { key: 'trade', label: 'Métier', options: Object.entries(TRADES) },
        ]}
      />
      <ErrorBox error={error} />
      <Table
        rows={data?.items}
        onRowClick={(p: any) => router.push(`/professionnel?id=${p._id}`)}
        columns={[
          { key: 'name', label: 'Professionnel', render: (p: any) => <><strong>{personName(p)}</strong><div className="muted small">{p.phone}</div></> },
          { key: 'trade', label: 'Métier', render: (p: any) => TRADES[p.trade] },
          { key: 'commune', label: 'Localisation', render: (p: any) => `${p.quartier ?? ''} ${p.commune ?? ''}` },
          { key: 'rating', label: 'Note', render: (p: any) => (p.reviewsCount ? `★ ${p.rating} (${p.reviewsCount})` : '—') },
          { key: 'availability', label: 'Disponibilité', render: (p: any) => <Badge status={p.availability} /> },
          { key: 'verificationStatus', label: 'Vérification', render: (p: any) => <Badge status={p.verificationStatus} /> },
          { key: 'createdAt', label: 'Inscrit le', render: (p: any) => date(p.createdAt) },
        ]}
      />
      <Pager data={data} onPage={setPage} />
      {exp && (
        <Modal title="Exporter la liste des prestataires" onClose={() => setExp(null)}>
          <p className="muted small" style={{ marginBottom: 12 }}>La liste s’ouvre dans un nouvel onglet avec nom, métier, téléphone, e-mail, localisation, position GPS, zone, horaires et statut. Choisissez « Enregistrer au format PDF » dans la fenêtre d’impression.</p>
          <div className="field"><label htmlFor="ex-st">Vérification</label>
            <select id="ex-st" value={exp.status} onChange={(e) => setExp({ ...exp, status: e.target.value })}><option value="">Tous les comptes</option>{V_STATUSES.map((s) => <option key={s} value={s}>{STATUS[s][0]}</option>)}</select></div>
          <div className="field"><label htmlFor="ex-tr">Métier</label>
            <select id="ex-tr" value={exp.trade} onChange={(e) => setExp({ ...exp, trade: e.target.value })}><option value="">Tous les métiers</option>{Object.entries(TRADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="field"><label htmlFor="ex-av">Disponibilité</label>
            <select id="ex-av" value={exp.availability} onChange={(e) => setExp({ ...exp, availability: e.target.value })}><option value="">Toutes</option><option value="available">Disponibles maintenant</option><option value="busy">Occupés</option><option value="unavailable">Indisponibles</option></select></div>
          <div className="hstack end gap" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setExp(null)}>Annuler</button>
            <button className="btn btn-primary" onClick={() => { window.open(`/impression/professionnels${qs({ status: exp.status || undefined, trade: exp.trade || undefined, availability: exp.availability || undefined })}`, '_blank'); setExp(null); }}>Générer le PDF</button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function Page() {
  return <Suspense><List /></Suspense>;
}

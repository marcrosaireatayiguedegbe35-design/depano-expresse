'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { dateTime, personName } from '@/lib/format';
import { useCan } from '@/components/admin-context';
import { Badge, Card, ErrorBox, Filters, Modal, PageHeader, Pager, ReasonModal, Table, Tabs, useList, useToast } from '@/components/ui';

const TARGETS: [string, string][] = [['user', 'Client'], ['professional', 'Professionnel'], ['message', 'Message'], ['review', 'Avis']];

function Reports() {
  const can = useCan();
  const toast = useToast();
  const { data, error, params, set, setPage, reload } = useList('/reports', { status: 'open' });
  const [open, setOpen] = useState<any>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const resolve = async (status: string) => {
    try {
      await api(`/reports/${open._id}/resolve`, { method: 'POST', body: { status, note } });
      toast('Signalement traité');
      setOpen(null);
      setNote('');
      reload();
    } catch (e: any) { setErr(e.message); }
  };
  return (
    <>
      <Filters params={params} set={set} selects={[
        { key: 'status', label: 'Statut', options: [['open', 'Ouvert'], ['resolved', 'Résolu'], ['dismissed', 'Classé']] },
        { key: 'targetType', label: 'Cible', options: TARGETS },
      ]} />
      <ErrorBox error={error} />
      <Table rows={data?.items} onRowClick={setOpen} empty="Aucun signalement" columns={[
        { key: 'createdAt', label: 'Date', render: (r: any) => dateTime(r.createdAt) },
        { key: 'reporterType', label: 'Signalé par', render: (r: any) => (r.reporterType === 'client' ? 'Client' : 'Professionnel') },
        { key: 'targetType', label: 'Cible', render: (r: any) => TARGETS.find((t) => t[0] === r.targetType)?.[1] },
        { key: 'reason', label: 'Motif' },
        { key: 'status', label: 'Statut', render: (r: any) => <Badge status={r.status} /> },
      ]} />
      <Pager data={data} onPage={setPage} />
      {open && (
        <Modal title="Signalement" onClose={() => setOpen(null)}>
          <p><strong>{open.reason}</strong></p>
          <p>{open.details}</p>
          <p className="small muted">Cible : {TARGETS.find((t) => t[0] === open.targetType)?.[1]} <span className="mono">{open.targetId}</span></p>
          {open.targetType === 'user' && <p className="small">Pour suspendre ce client, ouvrez la page Clients.</p>}
          {open.targetType === 'professional' && <p className="small"><a href={`/professionnel?id=${open.targetId}`}>Ouvrir le profil du professionnel →</a></p>}
          {open.resolution?.note && <div className="alert alert-success">{open.resolution.note} — {open.resolution.byEmail}</div>}
          {open.status === 'open' && can('moderation.write') && (
            <>
              <div className="field"><label htmlFor="n">Note de traitement</label><textarea id="n" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
              <ErrorBox error={err} />
              <div className="hstack gap end">
                <button className="btn" disabled={note.length < 3} onClick={() => resolve('dismissed')}>Classer sans suite</button>
                <button className="btn btn-primary" disabled={note.length < 3} onClick={() => resolve('resolved')}>Marquer résolu</button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

function Reviews() {
  const can = useCan();
  const { data, error, params, set, setPage, reload } = useList('/reviews');
  const [hiding, setHiding] = useState<any>(null);
  const show = async (r: any) => {
    await api(`/reviews/${r._id}/visibility`, { method: 'POST', body: { hidden: false } });
    reload();
  };
  return (
    <>
      <p className="small muted">Chaque avis est rattaché à une intervention réelle (un seul avis par intervention).</p>
      <Filters params={params} set={set} selects={[{ key: 'hidden', label: 'Visibilité', options: [['false', 'Visibles'], ['true', 'Masqués']] }]} />
      <ErrorBox error={error} />
      <Table rows={data?.items} columns={[
        { key: 'createdAt', label: 'Date', render: (r: any) => dateTime(r.createdAt) },
        { key: 'rating', label: 'Note', render: (r: any) => '★'.repeat(r.rating) },
        { key: 'comment', label: 'Commentaire' },
        { key: 'pro', label: 'Professionnel', render: (r: any) => personName(r.professionalId) },
        { key: 'client', label: 'Client', render: (r: any) => personName(r.clientId) },
        { key: 'ref', label: 'Intervention', render: (r: any) => r.interventionId?.reference },
        {
          key: 'a', label: '', render: (r: any) => can('moderation.write') && (r.hidden
            ? <button className="btn btn-sm" onClick={() => show(r)}>Réafficher</button>
            : <button className="btn btn-sm" onClick={() => setHiding(r)}>Masquer</button>),
        },
      ]} />
      <Pager data={data} onPage={setPage} />
      {hiding && (
        <ReasonModal title="Masquer l’avis" confirm="Masquer" onClose={() => setHiding(null)}
          onConfirm={async (reason) => { await api(`/reviews/${hiding._id}/visibility`, { method: 'POST', body: { hidden: true, reason } }); reload(); }} />
      )}
    </>
  );
}

export default function ModerationPage() {
  const [tab, setTab] = useState<'reports' | 'reviews'>('reports');
  return (
    <>
      <PageHeader title="Signalements & avis" />
      <Tabs tabs={[['reports', 'Signalements'], ['reviews', 'Avis']]} value={tab} onChange={setTab} />
      <Card>{tab === 'reports' ? <Reports /> : <Reviews />}</Card>
    </>
  );
}

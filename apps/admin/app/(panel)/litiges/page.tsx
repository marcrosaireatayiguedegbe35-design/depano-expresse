'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { dateTime, DISPUTE_DECISIONS, fcfa, personName } from '@/lib/format';
import { useCan } from '@/components/admin-context';
import { Badge, Card, ErrorBox, Filters, Modal, PageHeader, Pager, Table, useList, useToast } from '@/components/ui';

function DisputeModal({ d, onClose, onDone }: { d: any; onClose: () => void; onDone: () => void }) {
  const can = useCan();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState('request_new_version');
  const [error, setError] = useState<string | null>(null);
  const closed = d.status === 'resolved';

  const act = async (path: string, body: object, msg: string) => {
    setError(null);
    try {
      await api(`/disputes/${d._id}/${path}`, { method: 'POST', body });
      toast(msg);
      onDone();
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Modal title={`Litige – ${d.interventionId?.reference ?? ''}`} onClose={onClose} wide>
      <p><strong>Motif du client :</strong> {d.reason}</p>
      <p className="small muted">
        Client : {personName(d.clientId)} · Professionnel : {personName(d.professionalId)} · Facture {d.invoiceId?.number} v{d.invoiceId?.version} ({fcfa(d.invoiceId?.total)}) ·{' '}
        <Link href={`/interventions/${d.interventionId?._id}`}>Voir l’intervention complète</Link>
      </p>
      <h3>Notes internes</h3>
      {d.notes?.length ? d.notes.map((n: any, i: number) => <p key={i} className="small">{n.text} <span className="muted">— {n.byEmail}, {dateTime(n.at)}</span></p>) : <p className="muted small">Aucune note.</p>}
      {d.resolution?.decision && <div className="alert alert-success">Décision : {DISPUTE_DECISIONS[d.resolution.decision]} — {d.resolution.note} ({d.resolution.byEmail})</div>}

      {!closed && can('disputes.resolve') && (
        <>
          <div className="field">
            <label htmlFor="note">Note / justification</label>
            <textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="decision">Décision</label>
            <select id="decision" value={decision} onChange={(e) => setDecision(e.target.value)}>
              {Object.entries(DISPUTE_DECISIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <small className="muted">L’administration ne confirme jamais un montant à la place du client : toute facture corrigée doit être revalidée par lui.</small>
          </div>
          <ErrorBox error={error} />
          <div className="hstack gap end">
            <button className="btn" disabled={note.length < 2} onClick={() => act('notes', { text: note }, 'Note ajoutée')}>Ajouter la note</button>
            <button className="btn btn-primary" disabled={note.length < 5} onClick={() => act('resolve', { decision, note }, 'Litige clos')}>Clore le litige</button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function DisputesPage() {
  const { data, error, params, set, setPage, reload } = useList('/disputes', { status: 'open' });
  const [open, setOpen] = useState<any>(null);
  return (
    <>
      <PageHeader title="Litiges" subtitle="Contestations de factures : le paiement reste bloqué tant que le litige n’est pas résolu." />
      <Filters params={params} set={set} selects={[{ key: 'status', label: 'Statut', options: [['open', 'Ouvert'], ['in_review', 'En examen'], ['resolved', 'Résolu']] }]} />
      <ErrorBox error={error} />
      <Card>
        <Table rows={data?.items} onRowClick={setOpen} empty="Aucun litige" columns={[
          { key: 'createdAt', label: 'Ouvert le', render: (d: any) => dateTime(d.createdAt) },
          { key: 'ref', label: 'Intervention', render: (d: any) => d.interventionId?.reference },
          { key: 'reason', label: 'Motif' },
          { key: 'client', label: 'Client', render: (d: any) => personName(d.clientId) },
          { key: 'pro', label: 'Professionnel', render: (d: any) => personName(d.professionalId) },
          { key: 'amount', label: 'Montant', align: 'right', render: (d: any) => fcfa(d.invoiceId?.total) },
          { key: 'status', label: 'Statut', render: (d: any) => <Badge status={d.status === 'in_review' ? 'in_review' : d.status} /> },
        ]} />
        <Pager data={data} onPage={setPage} />
      </Card>
      {open && <DisputeModal d={open} onClose={() => setOpen(null)} onDone={reload} />}
    </>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { date, fcfa, personName } from '@/lib/format';
import { useCan } from '@/components/admin-context';
import { Badge, Card, ErrorBox, Filters, KV, Modal, PageHeader, Pager, ReasonModal, Table, useFetch, useList, useToast, Loading } from '@/components/ui';

function ClientModal({ id, onClose, onChange }: { id: string; onClose: () => void; onChange: () => void }) {
  const can = useCan();
  const toast = useToast();
  const { data, reload } = useFetch<any>(`/users/${id}`);
  const [suspending, setSuspending] = useState(false);
  if (!data) return <Modal title="Client" onClose={onClose}><Loading minHeight={160} /></Modal>;
  const u = data.user;
  const reactivate = async () => {
    await api(`/users/${id}/reactivate`, { method: 'POST' });
    toast('Compte réactivé');
    reload();
    onChange();
  };
  return (
    <Modal title={personName(u)} onClose={onClose} wide>
      <div className="hstack between" style={{ marginBottom: 12 }}>
        <Badge status={u.status} />
        {can('users.write') && (u.status === 'active'
          ? <button className="btn btn-danger btn-sm" onClick={() => setSuspending(true)}>Suspendre</button>
          : <button className="btn btn-primary btn-sm" onClick={reactivate}>Réactiver</button>)}
      </div>
      {u.suspension?.reason && <div className="alert alert-danger">Suspendu le {date(u.suspension.at)} : {u.suspension.reason}</div>}
      <KV items={[['Téléphone', u.phone], ['E-mail', u.email], ['Commune', u.commune], ['Inscrit le', date(u.createdAt)],
        ['Véhicules', data.vehicles.map((v: any) => `${v.brand} ${v.model} (${v.year})`).join(', ') || '—']]} />
      <h3>Interventions</h3>
      <Table rows={data.interventions} columns={[
        { key: 'reference', label: 'Réf.', render: (i: any) => <Link href={`/interventions/${i._id}`}>{i.reference}</Link> },
        { key: 'pro', label: 'Professionnel', render: (i: any) => personName(i.professionalId) },
        { key: 'status', label: 'Statut', render: (i: any) => <Badge status={i.status} /> },
        { key: 'createdAt', label: 'Date', render: (i: any) => date(i.createdAt) },
      ]} />
      <h3>Commandes marketplace</h3>
      <Table rows={data.orders} columns={[
        { key: 'number', label: 'N°' }, { key: 'total', label: 'Total', align: 'right', render: (o: any) => fcfa(o.total) },
        { key: 'status', label: 'Statut', render: (o: any) => <Badge status={o.status} /> },
      ]} />
      {suspending && (
        <ReasonModal title="Suspendre le client" confirm="Suspendre" onClose={() => setSuspending(false)}
          onConfirm={async (reason) => { await api(`/users/${id}/suspend`, { method: 'POST', body: { reason } }); reload(); onChange(); }} />
      )}
    </Modal>
  );
}

export default function ClientsPage() {
  const { data, error, params, set, setPage, reload } = useList('/users');
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="Clients" subtitle="Automobilistes inscrits" />
      <Filters params={params} set={set} search="Nom, e-mail, téléphone…" selects={[{ key: 'status', label: 'Statut', options: [['active', 'Actif'], ['suspended', 'Suspendu']] }]} />
      <ErrorBox error={error} />
      <Card>
        <Table rows={data?.items} onRowClick={(u: any) => setOpen(u._id)} columns={[
          { key: 'name', label: 'Nom', render: (u: any) => <strong>{personName(u)}</strong> },
          { key: 'phone', label: 'Téléphone' }, { key: 'email', label: 'E-mail' }, { key: 'commune', label: 'Commune' },
          { key: 'status', label: 'Statut', render: (u: any) => <Badge status={u.status} /> },
          { key: 'createdAt', label: 'Inscrit le', render: (u: any) => date(u.createdAt) },
        ]} />
        <Pager data={data} onPage={setPage} />
      </Card>
      {open && <ClientModal id={open} onClose={() => setOpen(null)} onChange={reload} />}
    </>
  );
}

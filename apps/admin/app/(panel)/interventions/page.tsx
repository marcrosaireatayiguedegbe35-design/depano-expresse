'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, Card, ErrorBox, Filters, PageHeader, Pager, Table, Tabs, useList } from '@/components/ui';
import { date, dateTime, fcfa, personName, STATUS, TRADES } from '@/lib/format';

const I_STATUSES = ['accepted', 'en_route', 'on_site', 'in_progress', 'completed', 'cancelled', 'contested', 'expired'];

function Interventions() {
  const router = useRouter();
  const { data, error, params, set, setPage } = useList('/interventions');
  return (
    <>
      <Filters params={params} set={set} search="Référence (INT-…)" selects={[
        { key: 'status', label: 'Statut', options: I_STATUSES.map((s) => [s, STATUS[s][0]]) },
        { key: 'trade', label: 'Métier', options: Object.entries(TRADES) },
      ]} />
      <ErrorBox error={error} />
      <Table rows={data?.items} onRowClick={(i: any) => router.push(`/intervention?id=${i._id}`)} columns={[
        { key: 'reference', label: 'Réf.', render: (i: any) => <strong>{i.reference}</strong> },
        { key: 'problem', label: 'Problème', render: (i: any) => <>{i.problem}<div className="muted small">{TRADES[i.trade]}</div></> },
        { key: 'client', label: 'Client', render: (i: any) => personName(i.clientId) },
        { key: 'pro', label: 'Professionnel', render: (i: any) => personName(i.professionalId) },
        { key: 'invoice', label: 'Facture', align: 'right', render: (i: any) => i.currentInvoiceId ? <>{fcfa(i.currentInvoiceId.total)}<div><Badge status={i.currentInvoiceId.status} /></div></> : '—' },
        { key: 'status', label: 'Statut', render: (i: any) => <Badge status={i.status} /> },
        { key: 'createdAt', label: 'Date', render: (i: any) => date(i.createdAt) },
      ]} />
      <Pager data={data} onPage={setPage} />
    </>
  );
}

function Requests() {
  const { data, error, params, set, setPage } = useList('/service-requests');
  return (
    <>
      <Filters params={params} set={set} selects={[
        { key: 'mode', label: 'Type', options: [['individual', 'Individuelle'], ['grouped', 'Groupée']] },
        { key: 'trade', label: 'Métier', options: Object.entries(TRADES) },
      ]} />
      <ErrorBox error={error} />
      <Table rows={data?.items} columns={[
        { key: 'createdAt', label: 'Date', render: (r: any) => dateTime(r.createdAt) },
        { key: 'mode', label: 'Type', render: (r: any) => r.mode === 'grouped' ? `Groupée (${r.recipients?.length ?? 0} pros)` : 'Individuelle' },
        { key: 'problem', label: 'Problème', render: (r: any) => <>{r.problem}<div className="muted small">{r.vehicle?.brand} {r.vehicle?.model}</div></> },
        { key: 'client', label: 'Client', render: (r: any) => personName(r.clientId) },
        { key: 'selected', label: 'Pro retenu', render: (r: any) => personName(r.selectedProfessionalId) },
        { key: 'urgency', label: 'Urgence', render: (r: any) => r.urgency === 'high' ? <Badge status="contested">Urgent</Badge> : 'Normale' },
        { key: 'status', label: 'Statut', render: (r: any) => <Badge status={r.status} /> },
      ]} />
      <Pager data={data} onPage={setPage} />
    </>
  );
}

export default function Page() {
  const [tab, setTab] = useState<'interventions' | 'requests'>('interventions');
  return (
    <>
      <PageHeader title="Demandes & interventions" subtitle="Suivi des demandes, devis, factures, validations et paiements" />
      <Tabs tabs={[['interventions', 'Interventions'], ['requests', 'Demandes']]} value={tab} onChange={setTab} />
      <Card>{tab === 'interventions' ? <Interventions /> : <Requests />}</Card>
    </>
  );
}

'use client';

import { useState } from 'react';
import { qs } from '@/lib/api';
import { dateTime, fcfa, num } from '@/lib/format';
import { Card, ErrorBox, PageHeader, Pager, Stat, Table, useFetch, useList } from '@/components/ui';
import { Icon } from '@/components/icons';

const ACTORS: Record<string, string> = { client: 'Client', professional: 'Professionnel', admin: 'Administrateur', system: 'Système' };
const TONE: Record<string, string> = {
  'payment.confirmed': 'success', 'invoice.confirmed': 'info', 'invoice.contested': 'danger', 'order.created': 'info',
  'request.new': 'warning', 'request.selected': 'success', 'client.registered': 'neutral', 'request.cancelled': 'neutral',
};

export default function OperationsPage() {
  const types = useFetch<{ key: string; label: string }[]>('/operations/types');
  const [f, setF] = useState({ q: '', type: '', actorType: '', from: '', to: '' });
  const { data, error, set, setPage } = useList<any>('/operations', { limit: 30 });
  const apply = (patch: Partial<typeof f>) => { const next = { ...f, ...patch }; setF(next); set(next); };
  const totals: any[] = (data as any)?.totals ?? [];
  const exportUrl = `/api/operations/export${qs(f)}`;
  const label = (k: string) => types.data?.find((t) => t.key === k)?.label ?? k;

  return (
    <>
      <PageHeader title="Journal des opérations" subtitle="Toutes les opérations effectuées sur la plateforme, en temps réel : demandes, devis, factures, paiements, commandes, inscriptions."
        actions={<a className="btn btn-primary" href={exportUrl}><Icon name="doc" /> Exporter (CSV)</a>} />

      <div className="stats">
        <Stat label="Opérations (filtre en cours)" value={num(data?.total ?? 0)} icon="list" />
        {totals.slice(0, 3).map((t) => (
          <Stat key={t._id} label={label(t._id)} value={num(t.count)} hint={t.amount ? fcfa(t.amount) : undefined} />
        ))}
      </div>

      <Card icon="list" title="Historique" subtitle="Les nouvelles opérations apparaissent automatiquement">
        <div className="filters">
          <input type="search" placeholder="Rechercher (détail, référence…)" aria-label="Rechercher" value={f.q} onChange={(e) => apply({ q: e.target.value })} />
          <select aria-label="Type d’opération" value={f.type} onChange={(e) => apply({ type: e.target.value })}>
            <option value="">Toutes les opérations</option>
            {types.data?.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <select aria-label="Acteur" value={f.actorType} onChange={(e) => apply({ actorType: e.target.value })}>
            <option value="">Tous les acteurs</option>
            {Object.entries(ACTORS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <label className="hstack gap small" style={{ margin: 0 }}>Du <input type="date" value={f.from} onChange={(e) => apply({ from: e.target.value })} style={{ width: 'auto' }} /></label>
          <label className="hstack gap small" style={{ margin: 0 }}>au <input type="date" value={f.to} onChange={(e) => apply({ to: e.target.value })} style={{ width: 'auto' }} /></label>
        </div>
        <ErrorBox error={error} />
        <Table rows={data?.items} empty="Aucune opération" columns={[
          { key: 'at', label: 'Date et heure', render: (r: any) => <span className="nowrap">{dateTime(r.at)}</span> },
          { key: 'title', label: 'Opération', render: (r: any) => <span className={`badge badge-${TONE[r.type] ?? 'info'}`}>{r.title}</span> },
          { key: 'body', label: 'Détail', render: (r: any) => r.body ?? '—' },
          { key: 'amount', label: 'Montant', align: 'right', render: (r: any) => (r.amount ? fcfa(r.amount) : '—') },
          { key: 'actor', label: 'Acteur', render: (r: any) => ACTORS[r.actorType] ?? '—' },
          { key: 'ref', label: 'Référence', render: (r: any) => (r.refId ? <span className="mono">{r.refType} · {String(r.refId).slice(-8)}</span> : '—') },
        ]} />
        <Pager data={data} onPage={setPage} />
      </Card>
    </>
  );
}

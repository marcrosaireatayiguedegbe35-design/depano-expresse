'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Badge, ErrorBox, Filters, PageHeader, Pager, Table, useList } from '@/components/ui';
import { date, personName, STATUS, TRADES } from '@/lib/format';

const V_STATUSES = ['pending', 'in_review', 'validated', 'rejected', 'suspended'];

function List() {
  const router = useRouter();
  const sp = useSearchParams();
  const { data, error, params, set, setPage } = useList('/professionals', { status: sp.get('status') ?? '' });
  return (
    <>
      <PageHeader title="Professionnels" subtitle="Vérification des comptes : seuls les comptes validés reçoivent des demandes." />
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
        onRowClick={(p: any) => router.push(`/professionnels/${p._id}`)}
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
    </>
  );
}

export default function Page() {
  return <Suspense><List /></Suspense>;
}

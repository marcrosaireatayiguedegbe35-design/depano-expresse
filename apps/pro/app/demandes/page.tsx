'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Blob, PageHead, Seg } from '@/components/ds';
import { Empty, Loading, useFetch } from '@/components/ui';
import { RequestCard } from '@/components/cards';

/** Demandes reçues : à traiter / historique. */
function Requests() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<'todo' | 'history'>(sp.get('tab') === 'history' ? 'history' : 'todo');
  const { data } = useFetch<any[]>(`/requests?tab=${tab === 'history' ? 'history' : 'todo'}`);
  return (
    <div className="screen">
      <Blob />
      <PageHead title="Demandes reçues" back={false} />
      <Seg value={tab} onChange={setTab} options={[{ value: 'todo', label: 'À traiter', icon: 'clipboard' }, { value: 'history', label: 'Historique', icon: 'clock' }]} />
      <section className="section stack">
        {!data ? <Loading rows={3} height={120} /> : data.length === 0
          ? <Empty icon="clipboard" title={tab === 'todo' ? 'Aucune demande à traiter' : 'Aucun historique'}>{tab === 'todo' ? 'Restez « Disponible » pour recevoir les demandes des clients proches.' : 'Vos réponses aux demandes apparaîtront ici.'}</Empty>
          : data.map((r) => <RequestCard key={r._id} r={r} />)}
      </section>
    </div>
  );
}

export default function RequestsPage() {
  return <Suspense><Requests /></Suspense>;
}

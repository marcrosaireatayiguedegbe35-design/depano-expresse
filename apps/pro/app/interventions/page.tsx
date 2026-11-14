'use client';

import { useState } from 'react';
import { Blob, PageHead, Seg } from '@/components/ds';
import { InterventionCard } from '@/components/cards';
import { Empty, Loading, useFetch } from '@/components/ui';

/** Interventions : en cours / terminées. */
export default function InterventionsPage() {
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const { data } = useFetch<any>(`/interventions?tab=${tab}&limit=50`);
  return (
    <div className="screen">
      <Blob />
      <PageHead title="Interventions" back={false} />
      <Seg value={tab} onChange={setTab} options={[{ value: 'active', label: 'En cours', icon: 'wrench' }, { value: 'done', label: 'Terminées', icon: 'checkCircle' }]} />
      <section className="section stack">
        {!data ? <Loading rows={3} height={120} /> : data.items.length === 0
          ? <Empty icon="wrench" title={tab === 'active' ? 'Aucune intervention en cours' : 'Aucune intervention terminée'}>Quand un client vous choisit, l’intervention apparaît ici.</Empty>
          : data.items.map((i: any) => <InterventionCard key={i._id} i={i} />)}
      </section>
    </div>
  );
}

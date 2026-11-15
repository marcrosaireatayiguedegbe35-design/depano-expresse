'use client';

import { useState } from 'react';
import { Seg } from '@/components/ds';
import { Empty, Loading, useFetch } from '@/components/ui';
import { InterventionCard } from '@/components/cards';

/** Interventions : en cours / terminées. */
export default function InterventionsPage() {
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const { data } = useFetch<any>(`/interventions?tab=${tab}&limit=50`);
  return (
    <div className="screen pg">
      <header className="pg-head"><div><h1>Interventions</h1><p>{data ? `${data.total} intervention${data.total > 1 ? 's' : ''} ${tab === 'active' ? 'en cours' : 'terminée' + (data.total > 1 ? 's' : '')}` : 'Vos missions auprès des clients'}</p></div></header>
      <Seg value={tab} onChange={setTab} options={[{ value: 'active', label: 'En cours', icon: 'wrench' }, { value: 'done', label: 'Terminées', icon: 'checkCircle' }]} />
      <section className="section iv-list">
        {!data ? <Loading rows={3} height={120} /> : data.items.length === 0
          ? <Empty icon="wrench" title={tab === 'active' ? 'Aucune intervention en cours' : 'Aucune intervention terminée'}>Quand un client accepte votre aide, l’intervention apparaît ici.</Empty>
          : data.items.map((i: any) => <InterventionCard key={i._id} i={i} />)}
      </section>
    </div>
  );
}

'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Blob, PageHead, Seg } from '@/components/ds';
import { Empty, Loading, useFetch } from '@/components/ui';
import { RequestCard } from '@/components/cards';
import { ConversationList } from '@/components/conversations';

/** Demandes reçues : urgences à traiter, demandes de contact (hors urgence), historique. */
function Requests() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<'todo' | 'contacts' | 'history'>(sp.get('tab') === 'history' ? 'history' : sp.get('tab') === 'contacts' ? 'contacts' : 'todo');
  const { data } = useFetch<any[]>(tab === 'contacts' ? null : `/requests?tab=${tab === 'history' ? 'history' : 'todo'}`);
  const conv = useFetch<any>('/conversations/unread');
  const badge = (conv.data?.pending ?? 0) + (conv.data?.unread ?? 0);
  return (
    <div className="screen">
      <Blob />
      <PageHead title="Demandes reçues" back={false} />
      <Seg value={tab} onChange={setTab} options={[{ value: 'todo', label: 'Urgences', icon: 'clipboard' }, { value: 'contacts', label: `Contacts${badge ? ` (${badge})` : ''}`, icon: 'chat' }, { value: 'history', label: 'Historique', icon: 'clock' }]} />
      <section className="section stack">
        {tab === 'contacts' ? <ConversationList /> : !data ? <Loading rows={3} height={120} /> : data.length === 0
          ? <Empty icon="clipboard" title={tab === 'todo' ? 'Aucune demande à traiter' : 'Aucun historique'}>{tab === 'todo' ? 'Restez « Disponible » pour recevoir les demandes des clients proches.' : 'Vos réponses aux demandes apparaîtront ici.'}</Empty>
          : data.map((r) => <RequestCard key={r._id} r={r} />)}
      </section>
    </div>
  );
}

export default function RequestsPage() {
  return <Suspense><Requests /></Suspense>;
}

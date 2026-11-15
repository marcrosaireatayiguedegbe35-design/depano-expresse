'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Seg } from '@/components/ds';
import { useSession } from '@/components/session';
import Link from 'next/link';
import { Icon } from '@/components/icons';
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
  const { pro } = useSession();
  const available = pro?.availability === 'available';
  return (
    <div className="screen pg">
      <header className="pg-head"><div><h1>Demandes reçues</h1><p>Urgences des clients proches et demandes de contact</p></div></header>
      {!available && tab === 'todo' && (
        <Link href="/" className="pg-alert rq-off"><Icon name="bolt" /><span><b>Vous êtes « {pro?.availability === 'busy' ? 'Occupé' : 'Indisponible'} »</b><small>Passez « Disponible » depuis l’accueil pour recevoir les urgences des clients proches.</small></span></Link>
      )}
      <Seg value={tab} onChange={setTab} options={[{ value: 'todo', label: 'Urgences', icon: 'clipboard' }, { value: 'contacts', label: `Contacts${badge ? ` (${badge})` : ''}`, icon: 'chat' }, { value: 'history', label: 'Historique', icon: 'clock' }]} />
      <section className="section rq-list">
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

'use client';

import Link from 'next/link';
import { dateTime, proName, TRADES } from '@/lib/format';
import { PageHead } from '@/components/ds';
import { Icon } from '@/components/icons';
import { Empty, ErrorBox, Loading, useFetch } from '@/components/ui';

const STATUS_LABEL: Record<string, [string, string]> = {
  pending: ['En attente', 'wait'], accepted: ['Acceptée', 'ok'], declined: ['Déclinée', 'no'], closed: ['Terminée', 'off'],
};

/** Mes messages : demandes de contact envoyées aux professionnels et discussions en cours. */
export default function MessagesPage() {
  const { data, error } = useFetch<any[]>('/conversations');
  return (
    <>
      <PageHead title="Mes messages" back="/compte" />
      <ErrorBox error={error} />
      {!data ? <Loading /> : data.length === 0 ? (
        <Empty icon="chat" title="Aucun message">
          Besoin d’un professionnel pour une révision ou un travail précis ? Trouvez-le dans Recherche et écrivez-lui.
          <Link href="/recherche" className="btn btn-primary btn-md" style={{ marginTop: 14 }}>Trouver un professionnel</Link>
        </Empty>
      ) : (
        <div className="msg-list">
          {data.map((c) => {
            const st = STATUS_LABEL[c.status] ?? ['', 'off'];
            return (
              <Link key={c._id} href={`/compte/message?id=${c._id}`} className={`msg-row${c.unread ? ' unread' : ''}`}>
                <span className="msg-av">{c.peer?.photoUrl ? <img src={c.peer.photoUrl} alt="" /> : (proName(c.peer ?? {})[0] ?? '?')}</span>
                <span className="grow">
                  <span className="msg-top"><b>{c.peer ? proName(c.peer) : 'Professionnel'}</b><small>{dateTime(c.lastMessageAt)}</small></span>
                  <span className="msg-sub">{TRADES[c.peer?.trade]?.label ?? ''}{c.topic ? ` · ${c.topic}` : ''}</span>
                  <span className="msg-last">{c.last ? `${c.last.from === 'client' ? 'Vous : ' : ''}${c.last.text}` : ''}</span>
                </span>
                <span className="msg-side">
                  <span className={`msg-st ${st[1]}`}>{st[0]}</span>
                  {c.unread > 0 && <span className="msg-n">{c.unread}</span>}
                </span>
              </Link>
            );
          })}
        </div>
      )}
      <p className="xs text-2 center" style={{ marginTop: 14 }}><Icon name="info" /> Pour une panne urgente, passez par « Nos services ».</p>
    </>
  );
}

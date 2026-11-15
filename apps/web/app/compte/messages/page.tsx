'use client';

import Link from 'next/link';
import { proName, TRADES } from '@/lib/format';
import { PageHead } from '@/components/ds';
import { Icon } from '@/components/icons';
import { Empty, ErrorBox, Loading, useFetch } from '@/components/ui';
import { when } from '@/components/chat-time';

const STATUS_LABEL: Record<string, [string, string]> = {
  pending: ['En attente', 'wait'], accepted: ['Acceptée', 'ok'], declined: ['Déclinée', 'no'], closed: ['Terminée', 'off'],
};

/** Mes messages : demandes de contact envoyées aux professionnels et discussions en cours. */
export default function MessagesPage() {
  const { data, error } = useFetch<any[]>('/conversations');
  const groups: [string, any[]][] = data ? [
    ['Discussions', data.filter((c) => c.status === 'accepted')],
    ['En attente de réponse', data.filter((c) => c.status === 'pending')],
    ['Terminées', data.filter((c) => ['declined', 'closed'].includes(c.status))],
  ] : [];
  const unread = data?.reduce((n, c) => n + (c.unread ?? 0), 0) ?? 0;

  return (
    <div className="mx">
      <PageHead title="Mes messages" back="/compte" />
      <ErrorBox error={error} />
      {!data ? <Loading /> : data.length === 0 ? (
        <Empty icon="chat" title="Aucun message">
          Besoin d’un professionnel pour une révision ou un travail précis ? Trouvez-le dans Recherche et écrivez-lui.
          <Link href="/recherche" className="btn btn-primary btn-md" style={{ marginTop: 14 }}>Trouver un professionnel</Link>
        </Empty>
      ) : (
        <>
          <p className="mx-sum"><b>{data.length}</b> conversation{data.length > 1 ? 's' : ''}{unread > 0 && <span className="mx-sum-new">{unread} non lu{unread > 1 ? 's' : ''}</span>}</p>
          {groups.filter(([, list]) => list.length > 0).map(([title, list]) => (
            <section key={title} className="mx-group">
              <h2 className="mx-group-title">{title}<span>{list.length}</span></h2>
              <div className="mx-list">
                {list.map((c) => {
                  const st = STATUS_LABEL[c.status] ?? ['', 'off'];
                  const name = c.peer ? proName(c.peer) : 'Professionnel';
                  return (
                    <Link key={c._id} href={`/compte/message?id=${c._id}`} className={`mx-row${c.unread ? ' unread' : ''}`}>
                      <span className={`mx-av ${st[1]}`}>{c.peer?.photoUrl ? <img src={c.peer.photoUrl} alt="" /> : (name[0] ?? '?')}<i aria-hidden /></span>
                      <span className="mx-main">
                        <span className="mx-top"><b>{name}</b><small>{when(c.lastMessageAt)}</small></span>
                        <span className="mx-sub">{[TRADES[c.peer?.trade]?.label, c.topic].filter(Boolean).join(' · ')}</span>
                        <span className="mx-last">
                          {c.last?.from === 'client' && <Icon name="check" className="mx-tick" />}
                          <span>{c.last ? `${c.last.from === 'client' ? 'Vous : ' : ''}${c.last.text}` : st[0]}</span>
                          {c.unread > 0 ? <span className="mx-n">{c.unread}</span> : <span className={`mx-st ${st[1]}`}>{st[0]}</span>}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
      <p className="mx-note"><Icon name="info" />Pour une panne urgente, passez par « Nos services ».</p>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { when } from './chat-time';
import { Icon } from './icons';
import { Empty, Loading, useFetch, useToast } from './ui';

export const CONV_STATUS: Record<string, [string, string]> = {
  pending: ['À accepter', 'wait'], accepted: ['Acceptée', 'ok'], declined: ['Déclinée', 'no'], closed: ['Terminée', 'off'],
};
export const clientName = (c?: any) => [c?.firstName, c?.lastName].filter(Boolean).join(' ') || 'Client';

/** Demandes de contact des clients (hors urgence) : accepter / décliner, puis discussions. */
export function ConversationList() {
  const { data, reload } = useFetch<any[]>('/conversations');
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const respond = async (id: string, accept: boolean) => {
    setBusy(id);
    try { await api(`/conversations/${id}/${accept ? 'accept' : 'decline'}`, { method: 'POST', body: {} }); toast(accept ? 'Demande acceptée : vous pouvez discuter' : 'Demande déclinée'); reload(); }
    catch (e: any) { toast(e.message, 'danger'); }
    finally { setBusy(null); }
  };
  if (!data) return <Loading rows={3} height={110} />;
  if (data.length === 0) return <Empty icon="chat" title="Aucune demande de contact">Les clients qui ont besoin de vous pour une révision ou un travail précis vous écrivent ici.</Empty>;
  const groups: [string, any[]][] = [
    ['Demandes à accepter', data.filter((c) => c.status === 'pending')],
    ['Discussions', data.filter((c) => c.status === 'accepted')],
    ['Terminées', data.filter((c) => ['declined', 'closed'].includes(c.status))],
  ];
  const unread = data.reduce((n, c) => n + (c.unread ?? 0), 0);
  return (
    <div className="mx">
      <p className="mx-sum"><b>{data.length}</b> conversation{data.length > 1 ? 's' : ''}{unread > 0 && <span className="mx-sum-new">{unread} non lu{unread > 1 ? 's' : ''}</span>}</p>
      {groups.filter(([, list]) => list.length > 0).map(([title, list]) => (
        <section key={title} className="mx-group">
          <h2 className="mx-group-title">{title}<span>{list.length}</span></h2>
          <div className="mx-list">
            {list.map((c) => {
              const st = CONV_STATUS[c.status] ?? ['', 'off'];
              const name = clientName(c.peer);
              return (
                <div key={c._id} className={`mx-card${c.status === 'pending' ? ' pending' : ''}`}>
                  <Link href={`/message?id=${c._id}`} className={`mx-row${c.unread || c.status === 'pending' ? ' unread' : ''}`}>
                    <span className={`mx-av ${st[1]}`}>{name[0]}<i aria-hidden /></span>
                    <span className="mx-main">
                      <span className="mx-top"><b>{name}</b><small>{when(c.lastMessageAt)}</small></span>
                      {c.topic && <span className="mx-sub">{c.topic}</span>}
                      <span className="mx-last">
                        {c.last?.from === 'professional' && <Icon name="check" className="mx-tick" />}
                        <span>{c.last ? `${c.last.from === 'professional' ? 'Vous : ' : ''}${c.last.text}` : st[0]}</span>
                        {c.unread > 0 ? <span className="mx-n">{c.unread}</span> : <span className={`mx-st ${st[1]}`}>{st[0]}</span>}
                      </span>
                    </span>
                  </Link>
                  {c.status === 'pending' && (
                    <div className="mx-actions">
                      <button className="btn btn-light btn-sm" disabled={busy === c._id} onClick={() => respond(c._id, false)}>Décliner</button>
                      <button className="btn btn-primary btn-sm" disabled={busy === c._id} onClick={() => respond(c._id, true)}><Icon name="check" />Accepter</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

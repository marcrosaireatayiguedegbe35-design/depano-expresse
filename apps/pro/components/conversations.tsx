'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
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
  return (
    <div className="msg-list">
      {data.map((c) => {
        const st = CONV_STATUS[c.status] ?? ['', 'off'];
        return (
          <div key={c._id} className={`msg-card${c.unread || c.status === 'pending' ? ' unread' : ''}`}>
            <Link href={`/messages/${c._id}`} className="msg-row">
              <span className="msg-av">{clientName(c.peer)[0]}</span>
              <span className="grow">
                <span className="msg-top"><b>{clientName(c.peer)}</b><small>{dateTime(c.lastMessageAt)}</small></span>
                {c.topic && <span className="msg-sub">{c.topic}</span>}
                <span className="msg-last">{c.last ? `${c.last.from === 'professional' ? 'Vous : ' : ''}${c.last.text}` : ''}</span>
              </span>
              <span className="msg-side"><span className={`msg-st ${st[1]}`}>{st[0]}</span>{c.unread > 0 && <span className="msg-n">{c.unread}</span>}</span>
            </Link>
            {c.status === 'pending' && (
              <div className="msg-actions">
                <button className="btn btn-light btn-sm" disabled={busy === c._id} onClick={() => respond(c._id, false)}>Décliner</button>
                <button className="btn btn-primary btn-sm" disabled={busy === c._id} onClick={() => respond(c._id, true)}><Icon name="check" />Accepter</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

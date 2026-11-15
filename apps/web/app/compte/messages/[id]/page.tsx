'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { dateTime, proName, TRADES } from '@/lib/format';
import { BackButton } from '@/components/ds';
import { Icon } from '@/components/icons';
import { CallButtons } from '@/components/calls';
import { ErrorBox, Loading, useFetch, useToast } from '@/components/ui';

const time = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Discussion avec un professionnel : en attente de son accord, puis messages et appel. */
export default function ConversationPage({ params }: { params: { id: string } }) {
  const { data, error, reload } = useFetch<any>(`/conversations/${params.id}`);
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const count = data?.messages?.length ?? 0;

  // Nouveaux messages : on interroge régulièrement tant que la conversation est ouverte.
  useEffect(() => {
    if (!data || !['pending', 'accepted'].includes(data.status)) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') reload(); }, 5000);
    return () => clearInterval(t);
  }, [data, reload]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [count]);

  if (error && !data) return <><BackButton href="/compte/messages" /><ErrorBox error={error} /></>;
  if (!data) return <Loading />;
  const p = data.peer ?? {};
  const name = proName(p);
  const open = data.status === 'accepted';

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try { await api(`/conversations/${params.id}/messages`, { method: 'POST', body: { text: text.trim() } }); setText(''); await reload(); }
    catch (err: any) { toast(err.message, 'danger'); }
    finally { setBusy(false); }
  };

  return (
    <div className="chat">
      <header className="chat-head">
        <BackButton href="/compte/messages" />
        <Link href={`/professionnels/${p._id}`} className="chat-peer">
          <span className="msg-av">{p.photoUrl ? <img src={p.photoUrl} alt="" /> : name[0] ?? '?'}</span>
          <span className="grow"><b>{name}</b><small>{TRADES[p.trade]?.label ?? ''}{data.topic ? ` · ${data.topic}` : ''}</small></span>
        </Link>
      </header>

      {open && <div className="chat-call"><CallButtons conversationId={data._id} peerName={name} phone={p.phone} /></div>}
      {data.status === 'pending' && <div className="chat-banner wait"><Icon name="clock" /><span><b>Demande envoyée</b>{name} doit l’accepter avant que vous puissiez discuter et l’appeler.</span></div>}
      {data.status === 'declined' && <div className="chat-banner no"><Icon name="info" /><span><b>Demande déclinée</b>Ce professionnel n’est pas disponible. <Link href="/recherche">Trouver un autre professionnel</Link></span></div>}
      {data.status === 'closed' && <div className="chat-banner off"><Icon name="info" /><span><b>Conversation terminée</b></span></div>}

      <div className="chat-msgs" aria-live="polite">
        <p className="chat-day">Demande du {dateTime(data.createdAt)}</p>
        {data.messages.map((m: any, i: number) => (
          <div key={i} className={`bubble ${m.from === 'client' ? 'me' : 'them'}`}><p>{m.text}</p><small>{time(m.at)}</small></div>
        ))}
        <div ref={end} />
      </div>

      {open && (
        <form className="chat-input" onSubmit={send}>
          <textarea rows={1} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Votre message…" aria-label="Votre message"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} />
          <button className="chat-send" disabled={busy || !text.trim()} aria-label="Envoyer"><Icon name="arrow" /></button>
        </form>
      )}
    </div>
  );
}

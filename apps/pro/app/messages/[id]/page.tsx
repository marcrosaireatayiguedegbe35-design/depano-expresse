'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { BackButton } from '@/components/ds';
import { Icon } from '@/components/icons';
import { CallButtons } from '@/components/calls';
import { clientName } from '@/components/conversations';
import { ErrorBox, Loading, useFetch, useToast } from '@/components/ui';

const time = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Discussion avec un client : accepter ou décliner sa demande, puis messages et appel. */
export default function ProConversationPage({ params }: { params: { id: string } }) {
  const { data, error, reload } = useFetch<any>(`/conversations/${params.id}`);
  const toast = useToast();
  const [text, setText] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const count = data?.messages?.length ?? 0;

  useEffect(() => {
    if (!data || !['pending', 'accepted'].includes(data.status)) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') reload(); }, 5000);
    return () => clearInterval(t);
  }, [data, reload]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [count]);

  if (error && !data) return <div className="screen"><BackButton href="/messages" /><ErrorBox error={error} /></div>;
  if (!data) return <div className="screen"><Loading /></div>;
  const c = data.peer ?? {};
  const name = clientName(c);

  const act = async (path: string, body: any, ok: string) => {
    setBusy(true);
    try { await api(`/conversations/${params.id}/${path}`, { method: 'POST', body }); if (ok) toast(ok); setText(''); setReply(''); await reload(); }
    catch (e: any) { toast(e.message, 'danger'); }
    finally { setBusy(false); }
  };

  return (
    <div className="screen chat">
      <header className="chat-head">
        <BackButton href="/messages" />
        <div className="chat-peer">
          <span className="msg-av">{name[0]}</span>
          <span className="grow"><b>{name}</b><small>{[data.topic, c.quartier, c.commune].filter(Boolean).join(' · ')}</small></span>
        </div>
      </header>

      {data.status === 'accepted' && <div className="chat-call"><CallButtons conversationId={data._id} peerName={name} phone={c.phone} /></div>}
      {data.status === 'declined' && <div className="chat-banner no"><Icon name="info" /><span><b>Demande déclinée</b></span></div>}
      {data.status === 'closed' && <div className="chat-banner off"><Icon name="info" /><span><b>Conversation terminée</b></span></div>}

      <div className="chat-msgs" aria-live="polite">
        <p className="chat-day">Demande du {dateTime(data.createdAt)}</p>
        {data.messages.map((m: any, i: number) => (
          <div key={i} className={`bubble ${m.from === 'professional' ? 'me' : 'them'}`}><p>{m.text}</p><small>{time(m.at)}</small></div>
        ))}
        <div ref={end} />
      </div>

      {data.status === 'pending' && (
        <div className="chat-decide">
          <p><b>{name}</b> souhaite vous confier un travail hors urgence. En acceptant, vous pourrez discuter, vous appeler, et vous verrez son numéro.</p>
          <textarea rows={2} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Réponse (facultatif) : disponibilités, prix indicatif…" aria-label="Réponse au client" />
          <div className="msg-actions">
            <button className="btn btn-light" disabled={busy} onClick={() => act('decline', { text: reply.trim() || undefined }, 'Demande déclinée')}>Décliner</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => act('accept', { text: reply.trim() || undefined }, 'Demande acceptée')}><Icon name="check" />Accepter</button>
          </div>
        </div>
      )}

      {data.status === 'accepted' && (
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); if (text.trim()) act('messages', { text: text.trim() }, ''); }}>
          <textarea rows={1} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Votre message…" aria-label="Votre message"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} />
          <button className="chat-send" disabled={busy || !text.trim()} aria-label="Envoyer"><Icon name="arrow" /></button>
        </form>
      )}
    </div>
  );
}

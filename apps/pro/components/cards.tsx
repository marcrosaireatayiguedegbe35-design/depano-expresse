'use client';

import Link from 'next/link';
import { dateTime, fcfa, STATUS } from '@/lib/format';
import { Icon, iconFor } from './icons';
import { tradeLabel } from './pro';

/** Carte d'une demande reçue. */
export function RequestCard({ r }: { r: any }) {
  const q = r.requestId;
  return (
    <Link href={`/demandes/${q._id}`} className="req-card">
      <div className="top">
        <span className="ic"><Icon name={iconFor(q.problem ?? tradeLabel(q.trade))} /></span>
        <div className="grow"><h3>{q.problem}</h3><span className="xs text-2">{q.mode === 'grouped' ? 'Demande groupée' : 'Demande directe'} · {dateTime(q.createdAt)}</span></div>
        <span className={`badge-s ${STATUS[r.status]?.[1] ?? 'neutral'}`}>{r.status === 'pending' ? 'Nouvelle' : STATUS[r.status]?.[0]}</span>
      </div>
      {q.description && <p>{q.description}</p>}
      <div className="meta">
        {q.urgency === 'high' && <span className="tag-urgent"><Icon name="bolt" />Urgent</span>}
        <span><Icon name="pinFill" />{q.address}</span>
        {q.vehicle?.brand && <span><Icon name="carFill" />{q.vehicle.brand} {q.vehicle.model}</span>}
      </div>
    </Link>
  );
}

/** Carte d'une intervention avec la progression des étapes. */
export function InterventionCard({ i }: { i: any }) {
  const steps = ['accepted', 'en_route', 'on_site', 'in_progress', 'completed'];
  const k = Math.max(0, steps.indexOf(i.status));
  return (
    <Link href={`/interventions/${i._id}`} className="req-card">
      <div className="top">
        <span className="ic"><Icon name={iconFor(i.problem ?? '')} /></span>
        <div className="grow"><h3>{i.problem}</h3><span className="xs text-2">{i.reference}{i.clientId?.firstName ? ` · ${i.clientId.firstName}` : ''}</span></div>
        <span className={`badge-s ${STATUS[i.status]?.[1] ?? 'neutral'}`}>{STATUS[i.status]?.[0] ?? i.status}</span>
      </div>
      {i.status !== 'cancelled' && <div className="steps" aria-hidden>{steps.map((s, n) => <i key={s} className={n <= k ? 'on' : ''} />)}</div>}
      <div className="meta"><span><Icon name="pinFill" />{i.address}</span>{i.currentInvoiceId && <span><Icon name="docFill" />{fcfa(i.currentInvoiceId.total)} · {STATUS[i.currentInvoiceId.status]?.[0]}</span>}</div>
    </Link>
  );
}


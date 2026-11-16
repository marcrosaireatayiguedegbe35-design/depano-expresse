'use client';

import Link from 'next/link';
import { areaLine, date, dateTime, fcfa, kmLabel, STATUS } from '@/lib/format';
import { Icon, iconFor } from './icons';
import { tradeLabel } from './pro';

/** Carte d'une demande reçue : problème, client attendu, urgence, distance et véhicule, en un coup d'œil. */
export function RequestCard({ r }: { r: any }) {
  const q = r.requestId;
  const isNew = r.status === 'pending';
  const st = STATUS[r.status] ?? [r.status, 'neutral'];
  return (
    <Link href={`/demande?id=${q._id}`} className={`rq${isNew ? ' new' : ''}${q.urgency === 'high' ? ' urgent' : ''}`}>
      <div className="rq-top">
        <span className="ic"><Icon name={iconFor(q.problem ?? tradeLabel(q.trade))} /></span>
        <span className="grow">
          <b>{q.problem}</b>
          <small>{q.mode === 'grouped' ? 'Demande groupée' : 'Demande directe'} · {dateTime(q.createdAt)}</small>
        </span>
        <i className={`pill ${isNew ? 'new' : st[1]}`}>{isNew ? 'Nouvelle' : st[0]}</i>
      </div>
      {q.description && <p className="rq-desc">{q.description}</p>}
      <div className="rq-tags">
        {q.urgency === 'high' && <span className="urg"><Icon name="bolt" />Urgent</span>}
        <span><Icon name="pinFill" />{areaLine(q.area) || q.address || 'Position du client'}</span>
        {r.distanceKm !== undefined && <span><Icon name="gps" />À {kmLabel(r.distanceKm)}</span>}
        {q.vehicle?.brand && <span><Icon name="carFill" />{q.vehicle.brand} {q.vehicle.model}</span>}
      </div>
      {isNew && <span className="rq-cta">Voir et répondre<Icon name="chevR" /></span>}
    </Link>
  );
}

const IV_STEPS: [string, string][] = [['accepted', 'Départ'], ['en_route', 'Trajet'], ['on_site', 'Sur place'], ['in_progress', 'Travaux'], ['completed', 'Terminé']];

/** Carte d'une intervention : problème, client, avancement en étapes, adresse et facture. */
export function InterventionCard({ i }: { i: any }) {
  const k = Math.max(0, IV_STEPS.findIndex(([s]) => s === i.status));
  const live = ['accepted', 'en_route', 'on_site', 'in_progress', 'contested'].includes(i.status);
  const st = STATUS[i.status] ?? [i.status, 'neutral'];
  const inv = i.currentInvoiceId;
  return (
    <Link href={`/intervention?id=${i._id}`} className={`iv${live ? ' live' : ''}`}>
      <div className="iv-top">
        <span className="ic"><Icon name={iconFor(i.problem ?? '')} /></span>
        <span className="grow"><b>{i.problem}</b><small>{i.clientId?.firstName ? `${i.clientId.firstName} · ` : ''}{i.reference}</small></span>
        <i className={`pill ${st[1]}`}>{st[0]}</i>
      </div>
      {i.status !== 'cancelled' && (
        <ol className="iv-steps">{IV_STEPS.map(([s, l], n) => <li key={s} className={n < k || i.status === 'completed' ? 'done' : n === k ? 'now' : ''}><span />{l}</li>)}</ol>
      )}
      <div className="iv-foot">
        <span><Icon name="pinFill" />{areaLine(i.requestId?.area) || i.address || 'Adresse du client'}</span>
        {inv ? <b>{fcfa(inv.total)}<small>{STATUS[inv.status]?.[0] ?? inv.status}</small></b> : <small>{date(i.updatedAt ?? i.createdAt)}</small>}
      </div>
    </Link>
  );
}



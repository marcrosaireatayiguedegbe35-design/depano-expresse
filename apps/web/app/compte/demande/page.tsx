'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { dateTime, fcfa, proName, TRADES } from '@/lib/format';
import { PageTitle } from '@/components/chrome';
import { Badge, ErrorBox, Loading, Stars, useFetch, useToast } from '@/components/ui';
import { Icon } from '@/components/icons';

function RequestDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const toast = useToast();
  const { data, error, reload } = useFetch<any>(`/requests/${params.id}`);
  const [actionError, setActionError] = useState<string | null>(null);
  const waiting = !!data && data.request.mode === 'individual' && !data.intervention && !['cancelled', 'expired'].includes(data.request.status)
    && data.responses.some((x: any) => ['pending', 'info_requested'].includes(x.status));
  // Demande directe : on attend l'acceptation du professionnel, puis on bascule sur le suivi en direct.
  useEffect(() => { if (data?.intervention && data.request.mode === 'individual') router.replace(`/compte/intervention?id=${data.intervention._id}`); }, [data?.intervention, data?.request?.mode, router]);
  useEffect(() => { if (!waiting) return; const t = setInterval(reload, 6000); return () => clearInterval(t); }, [waiting, reload]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const { request: r, responses, intervention } = data;
  const closed = ['cancelled', 'expired'].includes(r.status) || !!r.selectedProfessionalId;
  const proposals = responses.filter((x: any) => x.status === 'proposed');

  const select = async (responseId: string) => {
    setActionError(null);
    try {
      const res = await api(`/requests/${r._id}/select/${responseId}`, { method: 'POST' });
      toast('Professionnel choisi. Les autres ont été informés.');
      router.push(`/compte/intervention?id=${res.interventionId}`);
    } catch (e: any) { setActionError(e.message); }
  };

  return (
    <>
      <PageTitle title="Ma demande" back="/compte/demandes" />
      <div className="card" style={{ background: 'var(--peach-2)', boxShadow: 'none' }}>
        <div className="hstack">
          <span className="list-thumb" style={{ width: 56, height: 56, background: "var(--peach)" }}>{TRADES[r.trade]?.icon}</span>
          <div className="grow"><h3>{r.problem}</h3><p className="small muted">{r.mode === 'grouped' ? 'Demande groupée' : 'Demande individuelle'} · {dateTime(r.createdAt)}</p></div>
          <Badge status={r.status} />
        </div>
        <p className="small" style={{ marginTop: 10 }}>{r.description}</p>
        <p className="xs muted" style={{ marginTop: 6 }}>{r.vehicle?.brand} {r.vehicle?.model} {r.vehicle?.year ?? ''} · {r.address}</p>
      </div>

      {waiting && (
        <div className="wait-card">
          <span className="spinner" aria-hidden />
          <div><b>En attente de l’acceptation de {proName(responses[0]?.professionalId)}</b>
            <small>Votre demande et votre position lui ont été envoyées. Dès qu’il accepte, l’intervention démarre et cette page s’ouvre sur le suivi en direct.</small></div>
        </div>
      )}
      {r.mode === 'individual' && responses[0]?.status === 'declined' && (
        <div className="alert alert-info small mt">{proName(responses[0]?.professionalId)} n’est pas disponible pour cette demande{responses[0]?.message ? ` : « ${responses[0].message} »` : ''}. <Link className="link" href={`/service?trade=${r.trade}&step=pros&problem=${encodeURIComponent(r.problem)}`}>Choisir un autre professionnel</Link></div>
      )}

      {intervention && (
        <Link className="btn btn-primary btn-block mt" href={`/compte/intervention?id=${intervention._id}`}><Icon name="route" />Suivre l’intervention {intervention.reference}</Link>
      )}

      <section className="section">
        <div className="section-head"><h2>{r.mode === 'grouped' ? 'Propositions' : 'Réponse du professionnel'}</h2>{!closed && <span className="small muted">{proposals.length} proposition(s)</span>}</div>
        {!closed && proposals.length === 0 && <div className="alert alert-info small">Demande transmise. Vous serez notifié dès qu’un professionnel répond. Vous gardez toujours le choix final.</div>}
        <ErrorBox error={actionError} />
        {responses.map((x: any) => {
          const p = x.professionalId;
          return (
            <div key={x._id} className="card" style={{ marginBottom: 10 }}>
              <div className="hstack">
                <span className="list-thumb" style={{ width: 48, height: 48, background: "var(--peach)" }}>{TRADES[p?.trade]?.icon}</span>
                <div className="grow"><Link href={`/professionnel?id=${p?._id}`} style={{ color: 'var(--ink)', fontWeight: 600 }}>{proName(p)}</Link><div className="hstack small"><Stars value={p?.rating} count={p?.reviewsCount} /><span className="muted">· {p?.commune}</span></div></div>
                <Badge status={x.status} />
              </div>
              {x.message && <p className="small" style={{ marginTop: 8 }}>« {x.message} »</p>}
              {(x.estimatedPrice || x.etaMinutes) && (
                <div className="meta">{x.estimatedPrice && <span className="price">≈ {fcfa(x.estimatedPrice)}</span>}{x.etaMinutes && <span><Icon name="clock" />Arrivée ~{x.etaMinutes} min</span>}</div>
              )}
              {!closed && x.status === 'proposed' && (
                <div className="hstack" style={{ marginTop: 10 }}>
                  {x.proBusy
                    ? <button className="btn btn-sm btn-light grow" disabled title="Ce professionnel est en intervention chez un autre client">Occupé chez un autre client</button>
                    : <button className="btn btn-sm btn-primary grow" onClick={() => select(x._id)}>Choisir ce professionnel</button>}
                </div>
              )}
              {!closed && x.status === 'proposed' && x.proBusy && <p className="xs text-2" style={{ marginTop: 6 }}>Il est actuellement en intervention : vous pourrez le choisir dès qu’il aura terminé, ou choisir une autre proposition.</p>}
            </div>
          );
        })}
      </section>

      {!closed && (
        <button className="btn btn-danger btn-block" onClick={async () => {
          if (!confirm('Annuler cette demande ?')) return;
          await api(`/requests/${r._id}/cancel`, { method: 'POST' });
          reload();
        }}>Annuler la demande</button>
      )}
    </>
  );
}

/** Adresse statique (hébergement Cloudflare Pages) : l'identifiant arrive dans l'adresse sous la forme ?id=… */
function FromQuery() {
  const id = useSearchParams().get('id') ?? '';
  return <RequestDetail key={id} params={{ id }} />;
}

export default function Page() {
  return <Suspense><FromQuery /></Suspense>;
}

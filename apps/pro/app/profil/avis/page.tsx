'use client';

import { date } from '@/lib/format';
import { Blob, PageHead } from '@/components/ds';
import { useSession } from '@/components/session';
import { Empty, Loading, StarRow, useFetch } from '@/components/ui';

/** Avis laissés par les clients ayant payé une intervention. */
export default function ReviewsPage() {
  const { pro } = useSession();
  const { data } = useFetch<any[]>('/reviews');
  return (
    <div className="screen">
      <Blob soft />
      <PageHead title="Avis clients" back="/profil" />
      {pro?.reviewsCount ? (
        <section className="card peach hstack" style={{ gap: 14 }}>
          <b style={{ fontSize: 34, color: 'var(--orange)' }}>{pro.rating?.toFixed(1)}</b>
          <div><StarRow value={pro.rating ?? 0} /><p className="small text-2">{pro.reviewsCount} avis vérifiés</p></div>
        </section>
      ) : null}
      <section className="section">
        {!data ? <Loading rows={2} height={90} /> : data.length === 0 ? <Empty icon="star" title="Pas encore d’avis">Seuls les clients ayant payé une intervention peuvent laisser un avis.</Empty> : data.map((r) => (
          <div key={r._id} className="review">
            <span className="who">{r.author?.[0] ?? '?'}</span>
            <div className="grow"><div className="hstack between"><b>{r.author}</b><span className="xs text-2">{date(r.createdAt)}</span></div><StarRow value={r.rating} />{r.comment && <p className="small" style={{ marginTop: 4 }}>{r.comment}</p>}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

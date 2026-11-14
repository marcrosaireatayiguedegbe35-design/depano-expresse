'use client';

import Link from 'next/link';
import { dateTime, TRADES } from '@/lib/format';
import { PageTitle } from '@/components/chrome';
import { Badge, Empty, ErrorBox, Loading, useFetch } from '@/components/ui';
import { Icon, iconFor } from '@/components/icons';

export default function RequestsPage() {
  const { data, error } = useFetch<any>('/requests?limit=50');
  return (
    <>
      <PageTitle title="Mes demandes" back="/compte">
        <Link href="/depannage" className="icon-btn" style={{ background: 'var(--orange)', color: '#fff' }} aria-label="Nouvelle demande"><Icon name="plus" /></Link>
      </PageTitle>
      <ErrorBox error={error} />
      {!data ? <Loading /> : data.items.length === 0 ? <Empty icon="🧰" title="Aucune demande pour le moment"><Link href="/depannage" className="btn btn-primary" style={{ marginTop: 12 }}>Demander un dépannage</Link></Empty> : data.items.map((r: any) => (
        <Link key={r._id} href={`/compte/demandes/${r._id}`} className="list-row" style={{ color: 'var(--ink)' }}>
          <span className="list-thumb"><Icon name={iconFor(TRADES[r.trade]?.label ?? "")} /></span>
          <div className="grow">
            <h3>{r.problem}</h3>
            <p className="small muted">{r.mode === 'grouped' ? `Groupée · ${r.recipients.length} pros` : 'Individuelle'} · {dateTime(r.createdAt)}</p>
            <div style={{ marginTop: 4 }}><Badge status={r.status} /></div>
          </div>
          <Icon name="chevRight" className="chev" />
        </Link>
      ))}
    </>
  );
}

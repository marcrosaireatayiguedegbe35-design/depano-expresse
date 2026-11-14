'use client';

import Link from 'next/link';
import { date, fcfa, proName, TRADES } from '@/lib/format';
import { PageTitle } from '@/components/chrome';
import { Badge, Empty, ErrorBox, Loading, useFetch } from '@/components/ui';
import { Icon, iconFor } from '@/components/icons';

export default function InterventionsPage() {
  const { data, error } = useFetch<any>('/interventions?limit=50');
  return (
    <>
      <PageTitle title="Interventions & factures" back="/compte" />
      <ErrorBox error={error} />
      {!data ? <Loading /> : data.items.length === 0 ? <Empty icon="🔧" title="Aucune intervention pour le moment" /> : data.items.map((i: any) => (
        <Link key={i._id} href={`/compte/interventions/${i._id}`} className="list-row" style={{ color: 'var(--ink)' }}>
          <span className="list-thumb"><Icon name={iconFor(TRADES[i.trade]?.label ?? "")} /></span>
          <div className="grow">
            <h3>{i.problem}</h3>
            <p className="small muted">{proName(i.professionalId)} · {date(i.createdAt)}</p>
            <div className="hstack" style={{ marginTop: 4 }}>
              <Badge status={i.status} />
              {i.currentInvoiceId && <Badge status={i.currentInvoiceId.status} />}
            </div>
          </div>
          <div className="right">{i.currentInvoiceId && <span className="price">{fcfa(i.currentInvoiceId.total)}</span>}<Icon name="chevRight" className="chev" /></div>
        </Link>
      ))}
    </>
  );
}

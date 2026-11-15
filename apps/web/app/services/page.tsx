'use client';

import Link from 'next/link';
import { TRADES } from '@/lib/format';
import { tradeArt } from '@/lib/images';
import { Icon, iconFor } from '@/components/icons';
import { Blob, PageHead, TRADE_ICON } from '@/components/ds';
import { Loading, useFetch } from '@/components/ui';
import { Art } from '@/components/art';

const TONES = ['tc-peach', 'tc-blue', 'tc-green', 'tc-sand', 'tc-rose'];

/** Tous les services proposés : choisir un service ouvre la liste de ses professionnels. */
export default function ServicesPage() {
  const { data } = useFetch<any[]>('/service-categories');
  return (
    <div className="screen">
      <Blob soft />
      <PageHead title="Nos services" back="/" />
      <p className="text-2 small" style={{ marginBottom: 14 }}>Choisissez un service pour voir les professionnels vérifiés près de vous.</p>
      {!data ? <Loading rows={4} height={86} /> : (
        <div className="stack" style={{ gap: 12 }}>
          {data.map((c, n) => {
            const art = c.imageUrl || tradeArt(c.trade);
            return (
              <Link key={c.trade} href={`/service?trade=${c.trade}`} className={`svc-row ${TONES[n % TONES.length]}`}>
                <span className="art">{art ? <Art src={art} size={64} /> : <span className="art-ic"><Icon name={TRADE_ICON[c.trade] ?? iconFor(c.name)} /></span>}</span>
                <span className="grow">
                  <b>{c.name}</b>
                  <small>{c.description || TRADES[c.trade]?.desc || c.problems.slice(0, 3).map((p: any) => p.label).join(', ')}</small>
                  <em>{c.problems.length} problème{c.problems.length > 1 ? 's' : ''} pris en charge</em>
                </span>
                <span className="go"><Icon name="chevR" /></span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

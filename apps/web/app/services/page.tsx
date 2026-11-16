'use client';

import Link from 'next/link';
import { qs } from '@/lib/api';
import { TRADES } from '@/lib/format';
import { tradeArt, tradeCover } from '@/lib/images';
import { Icon, iconFor } from '@/components/icons';
import { PageHead, TRADE_ICON } from '@/components/ds';
import { Loading, useFetch } from '@/components/ui';
import { Art } from '@/components/art';

/** Tous les services proposés : grandes cartes photo, puis les problèmes fréquents en accès direct. */
export default function ServicesPage() {
  const { data } = useFetch<any[]>('/service-categories');
  const frequent = (data ?? []).flatMap((c) => c.problems.slice(0, 2).map((p: any) => ({ trade: c.trade, label: p.label, image: p.imageUrl as string | undefined }))).slice(0, 10);

  return (
    <div className="screen sv">
      <PageHead title="Nos services" back="/" />
      <section className="sv-intro">
        <span className="ic"><Icon name="shieldFill" /></span>
        <span className="grow"><b>Des pros vérifiés, près de chez vous</b><small>Choisissez un service, décrivez votre problème : seuls les professionnels de votre zone sont sollicités.</small></span>
      </section>

      {!data ? <Loading rows={2} height={180} /> : (
        <>
          <div className="sv-grid">
            {data.map((c) => {
              const photo = c.imageUrl || tradeArt(c.trade) || tradeCover(c.trade);
              return (
                <Link key={c.trade} href={`/service?trade=${c.trade}`} className="sv-card">
                  <span className="pic">
                    {photo ? <Art src={photo} size={480} /> : <span className="ph"><Icon name={TRADE_ICON[c.trade] ?? iconFor(c.name)} /></span>}
                    <i className="count">{c.problems.length} problème{c.problems.length > 1 ? 's' : ''}</i>
                  </span>
                  <span className="txt">
                    <b>{c.name}</b>
                    <small>{c.description || TRADES[c.trade]?.desc || c.problems.slice(0, 3).map((p: any) => p.label).join(', ')}</small>
                    <em>Voir les pros<Icon name="arrow" /></em>
                  </span>
                </Link>
              );
            })}
          </div>

          {frequent.length > 0 && (
            <section className="sv-freq">
              <h2>Problèmes fréquents</h2>
              <p>Touchez votre problème pour aller directement à la demande.</p>
              <div className="chips">
                {frequent.map((f) => (
                  <Link key={`${f.trade}-${f.label}`} href={`/service${qs({ trade: f.trade, problem: f.label })}`} className="chip">
                    <span className="ci">{f.image ? <img src={f.image} alt="" /> : <Icon name={iconFor(f.label)} />}</span>{f.label}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

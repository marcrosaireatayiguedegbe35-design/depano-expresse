'use client';

import Link from 'next/link';
import { useState } from 'react';
import { qs } from '@/lib/api';
import { openNow } from '@/lib/hours';
import { IMAGES } from '@/lib/images';
import { Icon } from '@/components/icons';
import { Blob, CompanyLogo, ImgOr, SearchBar } from '@/components/ds';
import { Empty, ErrorBox, Loading, useFetch } from '@/components/ui';

const cityOf = (address?: string) => address?.split(',').map((s) => s.trim()).filter(Boolean).pop();

/** Annuaire des entreprises (maquette 1). */
export default function CompaniesPage() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const { data, error } = useFetch<any>(`/companies${qs({ q: search, limit: 48 })}`);
  return (
    <div className="screen">
      <Blob />
      <header className="hero-head">
        <div className="txt">
          <h1 className="title-xl">Entreprises</h1>
          <p className="sub">Découvrez les entreprises de votre secteur</p>
        </div>
        <div className="art co-art"><ImgOr src={IMAGES.companies.buildings} icon="buildingFill" alt="" /></div>
      </header>

      <SearchBar value={q} onChange={(v) => { setQ(v); if (!v) setSearch(''); }} onSubmit={() => setSearch(q)} placeholder="Rechercher une entreprise…" />

      <section className="section stack" style={{ gap: 14 }}>
        <ErrorBox error={error} />
        {!data ? <Loading rows={3} height={130} /> : data.items.length === 0
          ? <Empty icon="building" title="Aucune entreprise trouvée">Essayez un autre nom ou une autre activité.</Empty>
          : data.items.map((c: any) => {
            const open = openNow(c.hours);
            const city = cityOf(c.address);
            return (
              <Link key={c._id} href={`/entreprises/${c._id}`} className="co-card">
                <CompanyLogo c={c} />
                <span className="grow">
                  <h3>{c.name}<span className="verified orange" title="Entreprise validée"><Icon name="check" /></span></h3>
                  <p className="act">{c.activity}</p>
                  <span className="meta" style={{ marginTop: 8 }}>
                    {city && <span><Icon name="pinFill" />{city}</span>}
                    {open !== null && <>{city && <i className="sep" />}<span className={`open${open ? '' : ' closed'}`}>{open ? 'Ouvert' : 'Fermé'}</span></>}
                  </span>
                </span>
                <span className="go-soft" aria-hidden><Icon name="chevR" /></span>
              </Link>
            );
          })}
      </section>

      <section className="section join">
        <img src={IMAGES.companies.join} alt="Professionnel souriant" />
        <div className="copy">
          <h3><Icon name="megaphone" />Vous êtes une entreprise ?</h3>
          <p>Rejoignez notre plateforme et développez votre visibilité.</p>
          <Link href="/entreprises/inscription" className="btn btn-primary btn-sm">Inscrire mon entreprise<Icon name="arrow" /></Link>
        </div>
      </section>
    </div>
  );
}

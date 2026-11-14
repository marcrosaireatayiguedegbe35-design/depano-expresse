'use client';

import { openNow } from '@/lib/hours';
import { Icon } from '@/components/icons';
import { BackButton, CompanyLogo } from '@/components/ds';
import { ErrorBox, Loading, useFetch } from '@/components/ui';

const wa = (n: string) => `https://wa.me/${n.replace(/[^\d]/g, '')}`;

/** Fiche entreprise (même langage graphique que la fiche professionnel). */
export default function CompanyPage({ params }: { params: { id: string } }) {
  const { data: c, error } = useFetch<any>(`/companies/${params.id}`);
  if (error) return <div className="screen"><div className="page-head"><BackButton href="/entreprises" /></div><ErrorBox error={error} /></div>;
  if (!c) return <div className="screen"><Loading rows={3} /></div>;
  const socials = Object.entries(c.socials ?? {}).filter(([, v]) => v) as [string, string][];
  const open = openNow(c.hours);
  return (
    <div className="screen">
      <div className="cover-hero">
        {c.bannerUrl ? <img className="bg" src={c.bannerUrl} alt="" /> : <div className="ph"><Icon name="buildingFill" /></div>}
        <div className="cover-tools"><BackButton href="/entreprises" /></div>
      </div>
      <div className="avatar-xl"><div className="in" style={{ background: '#fff' }}><CompanyLogo c={c} /></div></div>
      <h1 className="pro-title">{c.name} <span className="verified orange"><Icon name="check" /></span></h1>
      <p className="text-2" style={{ marginTop: 4 }}>{c.activity}</p>
      {open !== null && <span className={`status${open ? '' : ' off'}`} style={{ marginTop: 12 }}>{open ? 'Ouvert' : 'Fermé'}</span>}

      {c.description && <section className="section"><div className="sec-head ico"><h2><Icon name="briefcase" />À propos</h2></div><p className="about expanded">{c.description}</p></section>}

      <section className="section menu-list">
        {c.address && <div className="menu-card"><span className="ic"><Icon name="pinFill" /></span><span className="grow"><b>Adresse</b><span className="s">{c.address}</span></span></div>}
        {c.hours && <div className="menu-card"><span className="ic"><Icon name="clock" /></span><span className="grow"><b>Horaires</b><span className="s">{c.hours}</span></span></div>}
        {c.phone && <a className="menu-card" href={`tel:${c.phone}`}><span className="ic"><Icon name="phoneFill" /></span><span className="grow"><b>Téléphone</b><span className="s">{c.phone}</span></span><Icon name="chevR" className="chev" /></a>}
        {c.whatsapp && <a className="menu-card" href={wa(c.whatsapp)} target="_blank" rel="noopener noreferrer"><span className="ic"><Icon name="chatFill" /></span><span className="grow"><b>WhatsApp</b><span className="s">{c.whatsapp}</span></span><Icon name="chevR" className="chev" /></a>}
        {c.email && <a className="menu-card" href={`mailto:${c.email}`}><span className="ic"><Icon name="mail" /></span><span className="grow"><b>E-mail</b><span className="s">{c.email}</span></span><Icon name="chevR" className="chev" /></a>}
      </section>

      {socials.length > 0 && <div className="tags section">{socials.map(([k, v]) => <a key={k} className="opt sm" href={v} target="_blank" rel="noopener noreferrer">{k[0].toUpperCase() + k.slice(1)}</a>)}</div>}
      {c.gallery?.length > 0 && <div className="hscroll section">{c.gallery.map((u: string) => <img key={u} src={u} alt="" style={{ width: 220, height: 150, objectFit: 'cover', borderRadius: 16 }} loading="lazy" />)}</div>}
      {c.website && <div className="sticky-actions single"><a className="btn btn-primary" href={c.website} target="_blank" rel="noopener noreferrer">Visiter le site officiel<Icon name="arrow" /></a></div>}
    </div>
  );
}

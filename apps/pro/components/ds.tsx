'use client';

/**
 * Composants graphiques réutilisables des maquettes Depanno Expresse.
 * Les données affichées proviennent toujours de l'API (aucune valeur inventée).
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import { IMAGES } from '@/lib/images';
import { Icon } from './icons';

/* ---------- Décor ---------- */

export function Blob({ soft }: { soft?: boolean }) {
  return <><div className={`blob${soft ? ' blob-soft' : ''}`} aria-hidden /><div className="wash" aria-hidden /></>;
}

/** Trait orange sous les titres (« swoosh »). */
export function Swoosh({ width = 120 }: { width?: number }) {
  return (
    <svg className="swoosh" style={{ width }} viewBox="0 0 120 12" aria-hidden>
      <path d="M2 9C30 3 70 1 118 4" fill="none" stroke="url(#sw)" strokeWidth="4" strokeLinecap="round" />
      <defs><linearGradient id="sw" x1="0" x2="1"><stop offset="0" stopColor="#ff5a0a" /><stop offset="1" stopColor="#ff8d1f" stopOpacity=".3" /></linearGradient></defs>
    </svg>
  );
}

/** Silhouette de ville pêche avec vagues orange (bas des pages Bienvenue, Profil, Connexion…). */
export function Skyline({ waves = true, children }: { waves?: boolean; children?: ReactNode }) {
  return (
    <div className={`skyline${waves ? "" : " plain"}`} aria-hidden>
      <svg viewBox="0 0 400 150" preserveAspectRatio="none">
        <g fill="#ffd9c2" opacity=".75">
          <rect x="10" y="62" width="26" height="80" /><rect x="40" y="44" width="20" height="98" /><rect x="64" y="72" width="30" height="70" />
          <rect x="98" y="54" width="18" height="88" /><rect x="120" y="80" width="34" height="62" /><rect x="236" y="40" width="22" height="102" />
          <rect x="262" y="66" width="30" height="76" /><rect x="296" y="30" width="24" height="112" /><rect x="324" y="58" width="28" height="84" />
          <rect x="356" y="76" width="34" height="66" /><rect x="160" y="88" width="30" height="54" /><rect x="196" y="70" width="34" height="72" />
        </g>
        <g fill="#fff" opacity=".7">
          {[66, 80, 94, 108].map((y) => [14, 26, 44, 102, 240, 300, 310, 328, 340].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="5" height="6" />))}
        </g>
        {waves && <>
          <path d="M0 112 C70 88 150 132 230 108 S360 92 400 104 V150 H0Z" fill="#ffb680" opacity=".7" />
          <path d="M0 128 C90 108 170 146 260 124 S370 116 400 122 V150 H0Z" fill="url(#wv)" />
          <defs><linearGradient id="wv" x1="0" x2="1"><stop offset="0" stopColor="#ff6a10" /><stop offset="1" stopColor="#ff9a2e" /></linearGradient></defs>
        </>}
      </svg>
      {children}
    </div>
  );
}

/** Emplacement réservé propre lorsqu'une image n'a pas encore été fournie. */
export function ImgOr({ src, alt = '', icon, className, style, fit = 'cover' }: {
  src?: string | null; alt?: string; icon: string; className?: string; style?: React.CSSProperties; fit?: 'cover' | 'contain';
}) {
  if (src) return <img src={src} alt={alt} className={className} style={{ objectFit: fit, ...style }} loading="lazy" />;
  return <div className={`ph-img ${className ?? ''}`} style={style} role="img" aria-label={alt || 'Image à fournir'} title="Image à fournir"><Icon name={icon} /></div>;
}

/* ---------- En-têtes ---------- */

export function BackButton({ href }: { href?: string }) {
  const router = useRouter();
  return (
    <button className="back-btn" aria-label="Retour" onClick={() => (href ? router.push(href) : history.length > 1 ? router.back() : router.push('/'))}>
      <Icon name="back" />
    </button>
  );
}

/** Titre de page avec retour (pages secondaires). */
export function PageHead({ title, back = true, right }: { title: string; back?: boolean | string; right?: ReactNode }) {
  return (
    <div className="page-head">
      {back && <BackButton href={typeof back === 'string' ? back : undefined} />}
      <h1 className="grow">{title}</h1>
      {right}
    </div>
  );
}

export function SecHead({ title, icon, href, label = 'Voir tout', pill, onClick, right }: {
  title: ReactNode; icon?: string; href?: string; label?: string; pill?: boolean; onClick?: () => void; right?: ReactNode;
}) {
  return (
    <div className={`sec-head${icon ? ' ico' : ''}`}>
      <h2>{icon && <Icon name={icon} />}{title}</h2>
      {right}
      {href && <Link href={href} className={`see-all${pill ? ' pill' : ''}`}>{label}<Icon name="chevR" /></Link>}
      {onClick && !href && <button className={`see-all${pill ? ' pill' : ''}`} onClick={onClick}>{label}<Icon name="chevR" /></button>}
    </div>
  );
}

/* ---------- Saisie ---------- */

export function SearchBar({ value, onChange, onSubmit, placeholder, autoFocus }: {
  value: string; onChange: (v: string) => void; onSubmit?: () => void; placeholder: string; autoFocus?: boolean;
}) {
  return (
    <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}>
      <Icon name="search" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoFocus={autoFocus} />
      <button type="submit" className="go" aria-label="Rechercher"><Icon name="search" /></button>
    </form>
  );
}

export function Seg<T extends string>({ value, onChange, options, small }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: string; iconOn?: string }[]; small?: boolean;
}) {
  return (
    <div className={`seg${small ? ' sm' : ''}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={value === o.value && o.iconOn ? o.iconOn : o.icon} />}{o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Favoris ---------- */

/* ---------- Cartes ---------- */

/** Ligne de menu (maquettes Profil). */
export function MenuCard({ href, icon, title, sub, onClick, violet, count }: {
  href?: string; icon: string; title: string; sub?: string; onClick?: () => void; violet?: boolean; count?: number;
}) {
  const inner = (
    <>
      <span className={`ic${violet ? ' violet' : ''}`}><Icon name={icon} /></span>
      <span className="grow"><b>{title}</b>{sub && <span className="s">{sub}</span>}</span>
      {count ? <span className="count">{count}</span> : <Icon name="chevR" className="chev" />}
    </>
  );
  return href ? <Link href={href} className="menu-card">{inner}</Link> : <button className="menu-card" onClick={onClick}>{inner}</button>;
}

/** Numéro de l'assistance (variable NEXT_PUBLIC_SUPPORT_PHONE). */
export const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '';

/** Bandeau « Besoin d'assistance ? » / « Besoin d'aide ? ». */
export function AssistBanner({ title = 'Besoin d’assistance ?', text = 'Notre équipe est disponible 24h/24 et 7j/7 pour vous aider.', cta = 'Appeler maintenant', compact }: {
  title?: string; text?: string; cta?: string; compact?: boolean;
}) {
  return (
    <section className={`assist${compact ? ' compact' : ''}`}>
      <img src={IMAGES.profile.advisor} alt="Conseillère Depanno Expresse" />
      <div className="copy">
        <h3><svg className="spark" viewBox="0 0 24 24" aria-hidden><path d="M4 8 1.5 6.5M6.5 5 5.5 2M10 4.5l.6-3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>{title}</h3>
        <p>{text}</p>
        {SUPPORT_PHONE
          ? <a className="btn btn-primary btn-md" href={`tel:${SUPPORT_PHONE}`}><Icon name="phoneFill" />{cta}</a>
          : <Link className="btn btn-primary btn-md" href="/aide"><Icon name="headsetFill" />{cta === 'Appeler maintenant' ? 'Contacter' : cta}</Link>}
      </div>
    </section>
  );
}

export function Perks({ items, two }: { items: { icon: string; label: ReactNode; sub?: string }[]; two?: boolean }) {
  return (
    <div className={`perks${two ? ' two' : ''}`}>
      {items.map((p, i) => (
        <div key={i} className="perk"><Icon name={p.icon} /><span>{p.label}{p.sub && <small>{p.sub}</small>}</span></div>
      ))}
    </div>
  );
}

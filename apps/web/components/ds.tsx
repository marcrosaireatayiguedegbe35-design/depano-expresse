'use client';

/**
 * Composants graphiques réutilisables des maquettes Depanno Expresse.
 * Les données affichées proviennent toujours de l'API (aucune valeur inventée).
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fcfa, proName, TRADES, proPlace } from '@/lib/format';
import { IMAGES, labelImage, tradeArt, tradeCover } from '@/lib/images';
import { Icon, iconFor } from './icons';
import { Fav, useCart, useFavs, usePlace, useSession } from './session';
import { StarRow, useFetch, useToast } from './ui';
import { Art } from '@/components/art';

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

/** En-tête « Cotonou ▾ / Choisir ma position » + notifications + panier (Accueil, Professionnels). */
export function LocationTopbar() {
  const { place, setPicking } = usePlace();
  const { user } = useSession();
  const { count } = useCart();
  const notifs = useFetch<any>(user ? '/notifications?limit=1' : null);
  const unread = notifs.data?.unread ?? 0;
  return (
    <div className="topbar">
      <span className="brand-dot"><img src={IMAGES.brand.logo} alt="Depanno Expresse" /></span>
      <button className="loc grow" onClick={() => setPicking(true)} aria-label="Changer ma position">
        <strong>{place.label}<Icon name="chevD" /></strong>
        <span>{place.detail === 'Choisir ma position' || place.detail === 'Bénin' ? 'Choisir ma position' : place.detail}</span>
      </button>
      <Link href={user ? '/compte/notifications' : '/connexion?next=/compte/notifications'} className="round-btn" aria-label={`Notifications${unread ? `, ${unread} non lues` : ''}`}>
        <Icon name="bell" />{unread > 0 && <span className="count">{unread > 9 ? '9+' : unread}</span>}
      </Link>
      <Link href="/panier" className="round-btn" aria-label={`Panier, ${count} article(s)`}>
        <Icon name="cartFill" />{count > 0 && <span className="count">{count}</span>}
      </Link>
    </div>
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

export function HeartButton({ fav, className = 'heart' }: { fav: Fav; className?: string }) {
  const favs = useFavs();
  const toast = useToast();
  const on = favs.has(fav.kind, fav.id);
  return (
    <button type="button" className={`${className}${on ? ' on' : ''}`} aria-pressed={on} aria-label={on ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); favs.toggle(fav); toast(on ? 'Retiré des favoris' : 'Ajouté aux favoris'); }}>
      <Icon name="heart" />
    </button>
  );
}

export const proFav = (p: any): Fav => ({ kind: 'pro', id: p._id, name: proName(p), sub: TRADES[p.trade]?.label, icon: p.trade, rating: p.rating, image: p.photoUrl ?? tradeCover(p.trade) ?? undefined });
export const productFav = (p: any): Fav => ({ kind: 'product', id: p._id, name: p.name, sub: p.brand, image: p.images?.[0], price: p.promoPrice ?? p.price });

/* ---------- Cartes ---------- */

const TONES = ['tc-peach', 'tc-blue', 'tc-green', 'tc-sand', 'tc-rose'];
/** Icône d'un métier quand aucune image n'a été choisie dans le back-office. */
export const TRADE_ICON: Record<string, string> = { mecanicien: 'wrench', vulcanisateur: 'tire', electricien: 'battery', remorqueur: 'tow', soudeur: 'welding' };

/** Carte colorée d'un métier (Mécanicien / Vulcanisateur / Électricien auto…). */
export function TradeCard({ trade, index, href, desc }: { trade: string; index: number; href: string; desc?: string }) {
  const t = TRADES[trade];
  const art = tradeArt(trade);
  return (
    <Link href={href} className={`trade-card ${TONES[index % TONES.length]}`}>
      <div className="art">{art ? <Art src={art} size={84} /> : <span className="art-ic"><Icon name={TRADE_ICON[trade] ?? iconFor(t?.label ?? trade)} /></span>}</div>
      <h3>{t?.label ?? trade}</h3>
      <p>{desc ?? t?.desc}</p>
      <span className="go" aria-hidden><Icon name="arrow" /></span>
    </Link>
  );
}

const availLabel = (a?: string) => (a === 'available' ? 'Disponible' : a === 'busy' ? 'Occupé' : 'Indisponible');

/** Carte professionnel à couverture (maquette Recherche). */
export function ProCoverCard({ p, onRequest }: { p: any; onRequest?: (p: any) => void }) {
  const cover = p.photoUrl ?? tradeCover(p.trade);
  return (
    <article className="pro-card">
      <Link href={`/professionnel?id=${p._id}`} className="cover" aria-label={`Voir ${proName(p)}`}>
        {cover ? <img src={cover} alt="" loading="lazy" /> : <Icon name={iconFor(TRADES[p.trade]?.label ?? '')} className="ph" />}
        {p.availability === 'available' && <span className="badge-live"><Icon name="bolt" /><span>Disponible<br />maintenant</span></span>}
      </Link>
      <div className="body">
        <Link href={`/professionnel?id=${p._id}`}><h3>{proName(p)} <span className="verified" title="Professionnel vérifié"><Icon name="check" /></span></h3></Link>
        <p className="desc">{p.description || `${TRADES[p.trade]?.label ?? ''} à ${p.commune ?? ''}`}</p>
        <div className="meta" style={{ marginTop: 8 }}>
          {p.reviewsCount ? <span><Icon name="star" className="star" /><b style={{ color: 'var(--navy)' }}>{p.rating.toFixed(1)}</b> ({p.reviewsCount} avis)</span> : <span>Nouveau</span>}
          {p.distanceKm !== undefined && <><i className="sep" /><span><Icon name="pin" />À {String(p.distanceKm).replace('.', ',')} km</span></>}
          <i className="sep" />
          <span style={{ color: p.availability === 'available' ? 'var(--green)' : 'var(--text-2)', fontWeight: 600 }}><Icon name="bolt" />{availLabel(p.availability)}</span>
        </div>
        <div className="actions">
          <Link className="btn btn-outline btn-md" href={`/professionnel?id=${p._id}`}><Icon name="userFill" />Voir le profil</Link>
          {onRequest
            ? <button className="btn btn-primary btn-md" onClick={() => onRequest(p)}><Icon name="wrench" />Demander</button>
            : <Link className="btn btn-primary btn-md" href={`/professionnel?id=${p._id}&contact=1`}><Icon name="chatFill" />Écrire</Link>}
        </div>
      </div>
    </article>
  );
}

/** Carte professionnel large dégradée (maquette Professionnels). */
export function ProWideCard({ p }: { p: any }) {
  const art = p.photoUrl ?? tradeCover(p.trade);
  return (
    <article className="pro-wide">
      <span className={`live${p.availability === 'available' ? '' : p.availability === 'busy' ? ' busy' : ' off'}`}>{p.availability === 'available' ? 'En ligne' : availLabel(p.availability)}</span>
      <Link href={`/professionnel?id=${p._id}`} className="pic" aria-label={`Voir ${proName(p)}`}>
        {art ? <img src={art} alt="" className={p.photoUrl || p.trade !== 'remorqueur' ? 'cover' : ''} /> : <Icon name={iconFor(TRADES[p.trade]?.label ?? '')} />}
      </Link>
      <div className="info">
        <Link href={`/professionnel?id=${p._id}`}><h3>{proName(p)}</h3></Link>
        {p.reviewsCount ? <span className="hstack small" style={{ gap: 5 }}><Icon name="star" className="star" /><b>{p.rating.toFixed(1)}</b><span className="text-2">({p.reviewsCount} avis)</span></span> : <span className="small text-2">Nouveau</span>}
        <span className="hstack small text-2" style={{ gap: 5 }}><Icon name="pinFill" className="pin-o" />{proPlace(p)}{p.distanceKm !== undefined && ` · ${String(p.distanceKm).replace('.', ',')} km`}</span>
        <span className="pill-ok"><Icon name="checkCircle" />{p.availability === 'available' ? 'Disponible maintenant' : availLabel(p.availability)}</span>
      </div>
      <p className="tagline">{p.description ? `${p.description.slice(0, 60)}${p.description.length > 60 ? '…' : ''}` : TRADES[p.trade]?.label}</p>
      <Link className="btn btn-primary btn-sm btn-contact" href={`/professionnel?id=${p._id}`}><Icon name="userFill" />Voir le profil</Link>
    </article>
  );
}

/** Carte horizontale « Dépannage le plus rapide ». */
export function ProRowCard({ p }: { p: any }) {
  const pic = p.photoUrl ?? tradeCover(p.trade);
  return (
    <Link href={`/professionnel?id=${p._id}`} className="row-card">
      <span className="pic">{pic ? <img src={pic} alt="" loading="lazy" /> : <Icon name={iconFor(TRADES[p.trade]?.label ?? '')} />}</span>
      <span className="grow">
        <h3>{proName(p)}</h3>
        <span className="meta" style={{ marginTop: 6 }}><span><Icon name="pinFill" className="pin-o" />{[p.quartier, p.commune].filter(Boolean).join(' • ')}</span></span>
        <span className="meta" style={{ marginTop: 4 }}>{p.reviewsCount ? <span><Icon name="star" className="star" /><b style={{ color: 'var(--navy)' }}>{p.rating.toFixed(1)}</b> ({p.reviewsCount} avis)</span> : <span>{TRADES[p.trade]?.label}</span>}{p.distanceKm !== undefined && <span>· {String(p.distanceKm).replace('.', ',')} km</span>}</span>
      </span>
      <span className="go-soft" aria-hidden><Icon name="arrow" /></span>
    </Link>
  );
}

/** Ligne produit (maquette Marketplace) avec ajout au panier. */
export function ProductCard({ p }: { p: any }) {
  const cart = useCart();
  const toast = useToast();
  const price = p.promoPrice ?? p.price;
  const ribbon = p.topSeller ? { icon: 'fire', label: 'Top vente' } : p.isNew ? { icon: 'star', label: 'Nouveau' } : p.promoPrice ? { icon: 'tag', label: 'Promo' } : null;
  return (
    <article className="prod-card">
      <Link href={`/produit?id=${p._id}`} className="pic" aria-label={`Voir ${p.name}`}>
        {ribbon && <span className="ribbon"><Icon name={ribbon.icon} />{ribbon.label}</span>}
        {p.images?.[0] ? <img src={p.images[0]} alt="" loading="lazy" /> : labelImage(p.categoryId?.name) ? <img src={labelImage(p.categoryId?.name)!} alt="" loading="lazy" /> : <Icon name="cart" className="ph" />}
      </Link>
      <div>
        <HeartButton fav={productFav(p)} className="fav" />
        <Link href={`/produit?id=${p._id}`}><h3>{p.name}</h3></Link>
        <p className="brand">{p.brand ?? p.categoryId?.name}</p>
        <p className="price">{fcfa(price)}{p.promoPrice && <span className="old-price">{fcfa(p.price)}</span>}</p>
        <div className="foot">
          <StockPill stock={p.stock} />
          <button className="btn btn-primary btn-sm" disabled={p.stock <= 0} onClick={() => {
            cart.add({ productId: p._id, name: p.name, unitPrice: price, image: p.images?.[0], stock: p.stock }, 1);
            toast('Ajouté au panier');
          }}><Icon name="cart" />Ajouter</button>
        </div>
      </div>
    </article>
  );
}

export function StockPill({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="stock out">Rupture</span>;
  if (stock <= 5) return <span className="stock low"><Icon name="checkCircle" />Plus que {stock}</span>;
  return <span className="stock"><Icon name="checkCircle" />En stock</span>;
}

/** Logo d'entreprise : image fournie ou monogramme orange (maquette Annuaire). */
export function CompanyLogo({ c }: { c: any }) {
  return (
    <span className="co-logo">
      {c.logoUrl ? <img src={c.logoUrl} alt="" /> : <>
        <span className="mono">{(c.name?.[0] ?? '?').toUpperCase()}</span>
        <svg className="swoosh-lg" viewBox="0 0 90 22" aria-hidden><path d="M2 18C24 6 56 2 88 6" fill="none" stroke="#ff7a1a" strokeWidth="5" strokeLinecap="round" /></svg>
      </>}
    </span>
  );
}

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

/** Distance à vol d'oiseau entre la position choisie et un point [lng, lat]. */
export function useDistanceKm(coords?: number[]) {
  const { place } = usePlace();
  if (!coords || coords.length < 2) return undefined;
  const [lng, lat] = coords;
  const toR = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(toR(lat - place.lat) / 2) ** 2 + Math.cos(toR(place.lat)) * Math.cos(toR(lat)) * Math.sin(toR(lng - place.lng) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** Bannière « PUBLICITÉ » (Marketplace, Publicités & actualités) avec suivi des affichages et clics. */
export function AdBanner({ placement, limit = 3 }: { placement: string; limit?: number }) {
  const { data } = useFetch<any[]>(`/ads?placement=${placement}&limit=${limit}`);
  const [i, setI] = useState(0);
  const ads = data ?? [];
  const a = ads[i % Math.max(ads.length, 1)];
  useEffect(() => {
    if (ads.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % ads.length), 6000);
    return () => clearInterval(t);
  }, [ads.length]);
  useEffect(() => { if (a?._id) api(`/ads/${a._id}/impression`, { method: 'POST' }).catch(() => {}); }, [a?._id]);
  if (!a) return null;
  const href = a.link || a.website || a.companyId?.website;
  const click = () => api(`/ads/${a._id}/click`, { method: 'POST' }).catch(() => {});
  const cta = <>{a.ctaLabel || 'Profiter maintenant'}<Icon name="chevR" /></>;
  return (
    <>
      <section className="banner short" aria-roledescription="publicité">
        <div className="copy">
          <span className="tagpill yellow">{(a.sponsoredLabel || 'Publicité').toUpperCase()}</span>
          <h2>{a.title}{a.companyId?.name && <><br /><span className="tail" style={{ fontWeight: 500 }}>{a.companyId.name}</span></>}</h2>
          {href
            ? <a className="cta plain" href={href} target="_blank" rel="sponsored noopener noreferrer" onClick={click}>{cta}</a>
            : <Link className="cta plain" href={`/actualite?id=${a._id}`} onClick={click}>{cta}</Link>}
        </div>
        {a.imageUrl ? <div className="art"><img src={a.imageUrl} alt="" /></div> : <div className="art person"><img src={IMAGES.advertisements.fallback} alt="" /></div>}
      </section>
      {ads.length > 1 && <div className="dots">{ads.map((x, k) => <button key={x._id} className={k === i % ads.length ? 'on' : ''} onClick={() => setI(k)} aria-label={`Publicité ${k + 1}`} />)}</div>}
    </>
  );
}

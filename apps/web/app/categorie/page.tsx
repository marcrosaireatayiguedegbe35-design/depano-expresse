'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { qs } from '@/lib/api';
import { fcfa, TRADES } from '@/lib/format';
import { Icon, iconFor } from '@/components/icons';
import { BackButton, HeartButton, Perks, ProRowCard, productFav, Seg, StockPill } from '@/components/ds';
import { useCart, usePlace } from '@/components/session';
import { Empty, ErrorBox, Loading, useFetch, useToast } from '@/components/ui';

/** Professionnel compétent pour poser les produits d'une catégorie. */
const tradeFor = (slug = '') => (/pneu|chambre/.test(slug) ? 'vulcanisateur' : /batter|electr/.test(slug) ? 'electricien' : 'mecanicien');

/** Catalogue d'une catégorie de pièces (maquette 7 « Commande de pneus »). */
function CataloguePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const cart = useCart();
  const toast = useToast();
  const { place } = usePlace();
  const [tab, setTab] = useState<'products' | 'pros'>('products');
  const cats = useFetch<any[]>('/product-categories');
  const cat = cats.data?.find((c) => c._id === params.id);
  const { data, error } = useFetch<any>(`/products${qs({ category: params.id, sort: 'price_asc', limit: 24 })}`);
  const trade = tradeFor(cat?.slug);
  const pros = useFetch<any>(tab === 'pros' ? `/professionals/search${qs({ trade, lat: place.lat.toFixed(4), lng: place.lng.toFixed(4) })}` : null);

  const items: any[] = data?.items ?? [];
  const inStock = items.filter((p) => p.stock > 0);
  const best = useMemo(() => [...inStock].sort((a, b) => (a.promoPrice ?? a.price) - (b.promoPrice ?? b.price))[0], [inStock]);
  const others = items.filter((p) => p._id !== best?._id);
  const minPrice = best ? best.promoPrice ?? best.price : undefined;

  const order = (p: any) => {
    cart.add({ productId: p._id, name: p.name, unitPrice: p.promoPrice ?? p.price, image: p.images?.[0], stock: p.stock }, 1);
    toast('Ajouté au panier');
    router.push('/panier');
  };

  return (
    <div className="screen">
      <div className="cat-hero">
        <div className="copy">
          <h1>{cat?.name ?? '…'}</h1>
          <p className="brand">Catalogue Depanno Expresse</p>
          <div className="stat"><span className="ic">{cat?.imageUrl ? <img src={cat.imageUrl} alt="" style={{ width: '70%', height: '70%', objectFit: 'contain' }} /> : <Icon name={iconFor(cat?.name ?? '')} />}</span><span><b>{data ? data.total : '—'}</b><small>Produit(s)</small></span></div>
          <div className="stat"><span className="ic"><Icon name="tag" /></span><span><b>{minPrice !== undefined ? fcfa(minPrice) : '—'}</b><small>Meilleur prix</small></span></div>
          <div className="stat"><span className="ic"><Icon name="shieldFill" /></span><span><b className={inStock.length ? 'green' : ''}>{inStock.length ? 'En stock' : 'Rupture'}</b><small>{inStock.length} offre(s) disponible(s)</small></span></div>
        </div>
        <div className="visual">
          {best?.images?.[0] ? <img src={best.images[0]} alt={best.name} /> : cat?.imageUrl ? <img src={cat.imageUrl} alt={cat.name} /> : <Icon name={iconFor(cat?.name ?? '')} />}
        </div>
        <i className="podium" aria-hidden />
        <div className="cover-tools"><BackButton href="/marketplace" /></div>
      </div>

      <section className="card near">
        <div className="sec-head ico" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 16 }}><Icon name="sliders" />{tab === 'products' ? 'Offres disponibles' : 'Professionnels proches'}</h2>
          <Link className="see-all" href={tab === 'products' ? `/marketplace?category=${params.id}` : `/professionnels?trade=${trade}`}>Voir tous<Icon name="chevR" /></Link>
        </div>
        <Seg small value={tab} onChange={setTab} options={[{ value: 'products', label: 'Produits' }, { value: 'pros', label: 'Professionnels' }]} />

        {tab === 'products' ? (
          <div style={{ marginTop: 14 }}>
            <ErrorBox error={error} />
            {!data ? <Loading rows={1} height={200} /> : items.length === 0 ? <Empty icon="box" title="Aucun produit dans cette catégorie" /> : (
              <>
                {best && (
                  <article className="offer">
                    <span className="ribbon"><Icon name="star" />Meilleure offre</span>
                    <HeartButton fav={productFav(best)} className="heart" />
                    <div className="top">
                      <Link href={`/produit?id=${best._id}`} className="pic">{best.images?.[0] ? <img src={best.images[0]} alt="" /> : <Icon name={iconFor(cat?.name ?? '')} />}</Link>
                      <div>
                        <Link href={`/produit?id=${best._id}`}><h3>{best.name}</h3></Link>
                        {best.brand && <p className="small text-2">{best.brand}</p>}
                        <p className="price">{fcfa(best.promoPrice ?? best.price)}</p>
                        <StockPill stock={best.stock} />
                      </div>
                    </div>
                    <div className="seller">
                      <Icon name="shop" />
                      <span className="grow"><b>Depanno Expresse <span className="verified blue"><Icon name="check" /></span></b><small><Icon name="pin" />Livraison au Bénin</small></span>
                      <button className="btn btn-primary btn-sm" onClick={() => order(best)}><Icon name="cart" />Commander</button>
                    </div>
                  </article>
                )}
                <div className="stack" style={{ marginTop: 12, gap: 10 }}>
                  {others.map((p) => (
                    <Link key={p._id} href={`/produit?id=${p._id}`} className="mini-offer">
                      <span className="list-thumb">{p.images?.[0] ? <img src={p.images[0]} alt="" /> : <Icon name={iconFor(cat?.name ?? '')} />}</span>
                      <span className="grow"><b>{p.name}</b><small>{p.brand ?? ''}</small></span>
                      <span className="price" style={{ fontSize: 15 }}>{fcfa(p.promoPrice ?? p.price)}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="stack" style={{ marginTop: 14, gap: 10 }}>
            <p className="small text-2">{TRADES[trade]?.label} pour la pose ou le remplacement.</p>
            {!pros.data ? <Loading rows={2} height={110} /> : pros.data.items.length === 0
              ? <Empty icon="users" title="Aucun professionnel disponible à proximité" />
              : pros.data.items.slice(0, 5).map((p: any) => <ProRowCard key={p._id} p={p} />)}
          </div>
        )}
      </section>

      <div className="section"><Perks two items={[{ icon: 'shieldFill', label: 'Paiement sécurisé', sub: 'Achetez en toute confiance' }, { icon: 'truckFast', label: 'Livraison rapide', sub: 'Partout au Bénin' }]} /></div>
      <Link href="/aide" className="btn btn-outline btn-block section"><Icon name="headsetFill" />Contacter le vendeur</Link>
    </div>
  );
}

/** Adresse statique (hébergement Cloudflare Pages) : l'identifiant arrive dans l'adresse sous la forme ?id=… */
function FromQuery() {
  const id = useSearchParams().get('id') ?? '';
  return <CataloguePage key={id} params={{ id }} />;
}

export default function Page() {
  return <Suspense><FromQuery /></Suspense>;
}

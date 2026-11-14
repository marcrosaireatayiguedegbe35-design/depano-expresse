'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { api, qs } from '@/lib/api';
import { proName, TRADES } from '@/lib/format';
import { tradeArt, tradeCover } from '@/lib/images';
import { Icon, iconFor } from '@/components/icons';
import { BackButton, Blob, HeartButton, proFav, Seg, TRADE_ICON } from '@/components/ds';
import { usePlace, useSession } from '@/components/session';
import { Empty, ErrorBox, Loading, Modal, useFetch, useToast } from '@/components/ui';

/**
 * Parcours d'un service : 1) le client choisit ou décrit son problème, 2) il choisit un professionnel
 * de ce service et lui demande de l'aide (avec sa position). Si le pro accepte, l'intervention démarre.
 */
function ServiceFlow({ trade }: { trade: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const cats = useFetch<any[]>('/service-categories');
  const cat = cats.data?.find((c) => c.trade === trade);
  const name = cat?.name ?? TRADES[trade]?.label ?? 'Service';
  const art = cat?.imageUrl || tradeArt(trade);
  const step = sp.get('step') === 'pros' ? 'pros' : 'problem';
  const [problem, setProblem] = useState(sp.get('problem') ?? '');
  const [desc, setDesc] = useState(sp.get('desc') ?? '');
  const ready = !!problem || desc.trim().length >= 5;

  const next = () => router.push(`/services/${trade}${qs({ step: 'pros', problem, desc: desc.trim() })}`);

  return (
    <div className="screen dc">
      <Blob soft />
      <header className="dc-head">
        <BackButton href={step === 'pros' ? `/services/${trade}${qs({ problem, desc })}` : '/services'} />
        <div className="grow"><h1>{name}</h1><p>{step === 'problem' ? 'Étape 1 sur 2 · Votre problème' : 'Étape 2 sur 2 · Choisissez un professionnel'}</p></div>
        <span className="svc-badge">{art ? <img src={art} alt="" /> : <Icon name={TRADE_ICON[trade] ?? iconFor(name)} />}</span>
      </header>
      <div className="svc-steps" aria-hidden><i className="on" /><i className={step === 'pros' ? 'on' : ''} /></div>

      {step === 'problem' ? (
        <>
          <section className="section">
            <div className="dc-sec"><h2>Quel est votre problème ?</h2></div>
            {!cats.data ? <Loading rows={2} height={44} /> : (
              <div className="svc-problems">
                {(cat?.problems ?? []).map((p: any) => {
                  const on = problem === p.label;
                  return (
                    <button key={p.key} type="button" className={`svc-pb${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setProblem(on ? '' : p.label)}>
                      <span className="ic">{p.imageUrl ? <img src={p.imageUrl} alt="" /> : <Icon name={iconFor(p.label)} />}</span>
                      <span className="grow">{p.label}</span>
                      <span className="tick">{on && <Icon name="check" />}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
          <section className="section">
            <div className="dc-sec"><h2>Décrivez exactement votre problème</h2></div>
            <textarea className="svc-desc" maxLength={2000} value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="Ex. : la voiture ne démarre plus depuis ce matin, un voyant rouge s’allume…" />
            <p className="xs text-2" style={{ marginTop: 6 }}>Choisissez un problème dans la liste, écrivez-le, ou les deux.</p>
          </section>
          <div className="sticky-actions single">
            <button className="btn btn-primary" disabled={!ready} onClick={next}>Continuer<Icon name="arrow" /></button>
          </div>
        </>
      ) : (
        <ProsStep trade={trade} problem={problem} desc={desc} name={name} />
      )}
    </div>
  );
}

function ProsStep({ trade, problem, desc, name }: { trade: string; problem: string; desc: string; name: string }) {
  const router = useRouter();
  const { user } = useSession();
  const { place, setPicking } = usePlace();
  const [sort, setSort] = useState<'best' | 'near' | 'rating'>('best');
  const [asking, setAsking] = useState<any>(null);
  const { data } = useFetch<any>(`/professionals/search${qs({ trade, lat: place.lat.toFixed(4), lng: place.lng.toFixed(4), includeUnavailable: 'true' })}`);
  const items = useMemo(() => {
    const list = [...(data?.items ?? [])];
    if (sort === 'near') list.sort((a, b) => a.distanceKm - b.distanceKm);
    if (sort === 'rating') list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviewsCount ?? 0) - (a.reviewsCount ?? 0));
    return list;
  }, [data, sort]);

  const ask = (p: any) => {
    if (!user) return router.push(`/connexion?next=${encodeURIComponent(`/services/${trade}${qs({ step: 'pros', problem, desc })}`)}`);
    setAsking(p);
  };

  return (
    <>
      <section className="section card peach svc-recap">
        <Icon name="clipboard" />
        <div className="grow"><b>{problem || 'Problème décrit'}</b>{desc && <small>{desc}</small>}</div>
      </section>
      <button className="dc-loc" onClick={() => setPicking(true)} aria-label="Changer ma position">
        <Icon name="pinFill" className="pin" /><span className="grow"><b>Près de {place.label}</b><small>Votre position sera transmise au professionnel choisi</small></span><Icon name="settings" className="gear" />
      </button>
      <div className="section"><Seg small value={sort} onChange={setSort} options={[{ value: 'best', label: 'Recommandés' }, { value: 'near', label: 'Plus proches' }, { value: 'rating', label: 'Mieux notés' }]} /></div>
      <section className="section">
        {!data ? <Loading rows={3} height={110} /> : items.length === 0
          ? <Empty icon="users" title={`Aucun professionnel en ${name.toLowerCase()} pour le moment`}>Changez de position ou essayez plus tard. <Link className="link" href="/services">Autres services</Link></Empty>
          : (
            <div className="stack" style={{ gap: 12 }}>
              <p className="small text-2">{items.length} professionnel{items.length > 1 ? 's' : ''} {data.expanded ? `dans un rayon de ${data.radiusKm} km` : 'à proximité'}</p>
              {items.map((p: any) => {
                const pic = p.photoUrl ?? tradeCover(p.trade);
                const busy = p.availability !== 'available';
                return (
                  <article key={p._id} className="dc-pack" style={{ position: 'relative' }}>
                    <Link href={`/professionnels/${p._id}`} className="pic">{pic ? <img src={pic} alt="" loading="lazy" /> : <Icon name={TRADE_ICON[p.trade] ?? 'wrench'} />}<i className={`dot ${p.availability}`} /></Link>
                    <div className="grow">
                      <Link href={`/professionnels/${p._id}`}><h3 style={{ paddingRight: 34 }}>{proName(p)} <span className="verified"><Icon name="check" /></span></h3></Link>
                      <p>{[p.quartier, p.commune].filter(Boolean).join(', ')}</p>
                      <div className="row">
                        <span className="meta-l">{p.reviewsCount ? <><Icon name="star" className="star" />{p.rating.toFixed(1)}</> : <span className="new">Nouveau</span>}{p.distanceKm !== undefined && <> · {String(p.distanceKm).replace('.', ',')} km</>}{busy && <> · <span className="busy">{p.availability === 'busy' ? 'Occupé' : 'Indisponible'}</span></>}</span>
                        <button className="btn-mini" disabled={busy} onClick={() => ask(p)}>{busy ? 'Indisponible' : 'Demander de l’aide'}</button>
                      </div>
                    </div>
                    <HeartButton fav={proFav(p)} className="heart fav-corner" />
                  </article>
                );
              })}
            </div>
          )}
      </section>
      {asking && <AskSheet pro={asking} trade={trade} problem={problem} desc={desc} onClose={() => setAsking(null)} />}
    </>
  );
}

/** Envoi de la demande au professionnel choisi : véhicule, repère, téléphone, urgence et position. */
function AskSheet({ pro, trade, problem, desc, onClose }: { pro: any; trade: string; problem: string; desc: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const { place } = usePlace();
  const vehicles = useFetch<any[]>('/vehicles');
  const [pos, setPos] = useState<{ lat: number; lng: number; gps: boolean }>({ lat: place.lat, lng: place.lng, gps: false });
  const [f, setF] = useState({ vehicleId: '', brand: '', model: '', address: '', phone: (user?.phone ?? '').replace(/^\+229/, ''), urgency: 'normal' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  useEffect(() => {
    // Position précise du client (avec son accord) ; à défaut, la commune choisie.
    navigator.geolocation?.getCurrentPosition((p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, gps: true }), () => {}, { enableHighAccuracy: true, timeout: 10000 });
  }, []);
  useEffect(() => { const v = vehicles.data?.[0]; if (v && !f.vehicleId && !f.brand) setF((s) => ({ ...s, vehicleId: v._id, brand: v.brand, model: v.model })); }, [vehicles.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const description = (desc.trim() || `Problème signalé : ${problem}`).padEnd(5, '.');
    try {
      const v = vehicles.data?.find((x) => x._id === f.vehicleId);
      const r = await api('/requests', {
        method: 'POST',
        body: {
          mode: 'individual', trade, problem: problem || 'Autre problème', description,
          vehicle: { brand: v?.brand ?? f.brand, model: v?.model ?? f.model, ...(v?.year ? { year: v.year } : {}) }, ...(v ? { vehicleId: v._id } : {}),
          lat: pos.lat, lng: pos.lng, address: f.address, phone: `+229${f.phone.replace(/\D/g, '')}`, urgency: f.urgency, professionalIds: [pro._id],
        },
      });
      toast(`Demande envoyée à ${proName(pro)}`);
      router.push(`/compte/demandes/${r._id}`);
    } catch (e2: any) { setErr(e2.message); setBusy(false); }
  };

  return (
    <Modal title={`Demander de l’aide à ${proName(pro)}`} onClose={onClose}>
      <form onSubmit={send}>
        <p className={`svc-gps${pos.gps ? ' ok' : ''}`}><Icon name="gps" />{pos.gps ? 'Votre position GPS précise sera transmise.' : `Position : ${place.label} (autorisez la localisation pour plus de précision).`}</p>
        {vehicles.data && vehicles.data.length > 0 ? (
          <div className="field"><label htmlFor="vh">Véhicule</label>
            <select id="vh" value={f.vehicleId} onChange={(e) => set('vehicleId', e.target.value)}>
              {vehicles.data.map((v) => <option key={v._id} value={v._id}>{v.brand} {v.model} {v.year ?? ''}</option>)}
              <option value="">Autre véhicule</option>
            </select>
          </div>
        ) : null}
        {!f.vehicleId && (
          <div className="form-grid">
            <div className="field"><label htmlFor="br">Marque</label><input id="br" required value={f.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Toyota" /></div>
            <div className="field"><label htmlFor="mo">Modèle</label><input id="mo" required value={f.model} onChange={(e) => set('model', e.target.value)} placeholder="Corolla" /></div>
          </div>
        )}
        <div className="field"><label htmlFor="ad">Où êtes-vous ? (repère)</label><input id="ad" required minLength={3} value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Carrefour, station, quartier…" /></div>
        <div className="field"><label htmlFor="ph">Téléphone</label><input id="ph" type="tel" required pattern="[0-9 ]{8,14}" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="01 XX XX XX XX" /></div>
        <div className="tags" style={{ marginBottom: 10 }}>
          {[['high', 'Urgent'], ['normal', 'Normal'], ['low', 'Pas pressé']].map(([v, l]) => <button type="button" key={v} className={`opt${f.urgency === v ? ' on' : ''}`} onClick={() => set('urgency', v)}>{l}</button>)}
        </div>
        <ErrorBox error={err} />
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer la demande'}</button>
        <p className="xs text-2" style={{ marginTop: 8 }}>Le professionnel reçoit votre demande dans son espace. Dès qu’il l’accepte, l’intervention démarre et vous suivez son arrivée en direct.</p>
      </form>
    </Modal>
  );
}

export default function Page({ params }: { params: { trade: string } }) {
  return <Suspense><ServiceFlow trade={params.trade} /></Suspense>;
}

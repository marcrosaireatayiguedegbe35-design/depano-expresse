'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { api, qs } from '@/lib/api';
import { proName, TRADES } from '@/lib/format';
import { IMAGES } from '@/lib/images';
import { Icon } from '@/components/icons';
import { AssistBanner, BackButton, ImgOr, ProCoverCard, SecHead, Seg } from '@/components/ds';
import { usePlace, useSession } from '@/components/session';
import { Empty, ErrorBox, Loading, useFetch, useToast } from '@/components/ui';
import { LogoLoading } from '@/components/brand-loader';

const Map = dynamic(() => import('@/components/map'), { ssr: false, loading: () => <LogoLoading logo="/images/brand/embleme-depanno.png" label="Chargement de la carte" minHeight={340} /> });

type Pos = { lat: number; lng: number };

/** Les 8 tuiles de la maquette 3, reliées au métier compétent. */
const PROBLEMS: { key: string; label: string; trade: string | null; problem: string; img: string | null; icon: string }[] = [
  { key: 'meca', label: 'Mécanique', trade: 'mecanicien', problem: 'Panne mécanique', img: IMAGES.breakdown.mechanic, icon: 'gear' },
  { key: 'pneu', label: 'Pneu (crevaison)', trade: 'vulcanisateur', problem: 'Pneu crevé', img: IMAGES.breakdown.tire, icon: 'tire' },
  { key: 'batt', label: 'Batterie', trade: 'electricien', problem: 'Batterie à plat', img: IMAGES.breakdown.battery, icon: 'battery' },
  { key: 'fuel', label: 'Carburant', trade: 'mecanicien', problem: 'Problème de carburant', img: IMAGES.breakdown.fuel, icon: 'fuel' },
  { key: 'acc', label: 'Accident', trade: 'remorqueur', problem: 'Accident', img: IMAGES.breakdown.accident, icon: 'crash' },
  { key: 'total', label: 'Panne totale', trade: 'remorqueur', problem: 'Véhicule immobilisé', img: IMAGES.breakdown.totalBreakdown, icon: 'immobile' },
  { key: 'key', label: 'Clé perdue ou bloquée', trade: 'mecanicien', problem: 'Clé perdue ou bloquée', img: IMAGES.breakdown.key, icon: 'key' },
  { key: 'other', label: 'Autre problème', trade: null, problem: 'Autre problème', img: IMAGES.breakdown.other, icon: 'help' },
];

/** « Options rapides » de la maquette. */
const QUICK: { label: string; trade: string }[] = [
  { label: 'Pneu crevé', trade: 'vulcanisateur' },
  { label: 'Batterie à plat', trade: 'electricien' },
  { label: 'Panne moteur', trade: 'mecanicien' },
  { label: 'Problème de démarrage', trade: 'electricien' },
  { label: 'Problème de carburant', trade: 'mecanicien' },
  { label: 'Remorquage', trade: 'remorqueur' },
  { label: 'Assistance 24/7', trade: 'remorqueur' },
];

function RequestForm({ trade, problem, pos, pros, onDone, onCancel }: {
  trade: string; problem: string; pos: Pos; pros: any[]; onDone: (id: string) => void; onCancel: () => void;
}) {
  const { user } = useSession();
  const toast = useToast();
  const vehicles = useFetch<any[]>(user ? '/vehicles' : null);
  const [f, setF] = useState({ description: '', brand: '', model: '', year: '', vehicleId: '', address: '', phone: user?.phone ?? '+229', urgency: 'normal', preferredDate: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const pickVehicle = (id: string) => {
    const v = vehicles.data?.find((x) => x._id === id);
    setF((s) => ({ ...s, vehicleId: id, brand: v?.brand ?? s.brand, model: v?.model ?? s.model, year: v?.year ? String(v.year) : s.year }));
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api('/requests', {
        method: 'POST',
        body: {
          mode: pros.length > 1 ? 'grouped' : 'individual', trade, problem, description: f.description,
          vehicle: { brand: f.brand, model: f.model, ...(f.year ? { year: Number(f.year) } : {}) },
          ...(f.vehicleId ? { vehicleId: f.vehicleId } : {}),
          lat: pos.lat, lng: pos.lng, address: f.address, phone: f.phone.replace(/\s/g, ''), urgency: f.urgency,
          ...(f.preferredDate ? { preferredDate: f.preferredDate } : {}),
          professionalIds: pros.map((p) => p._id),
        },
      });
      toast(pros.length > 1 ? `Demande envoyée à ${pros.length} professionnels` : 'Demande envoyée');
      onDone(r._id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="screen" onSubmit={submit}>
      <div className="page-head">
        <button type="button" className="back-btn" onClick={onCancel} aria-label="Retour"><Icon name="back" /></button>
        <h1 className="grow">Votre demande</h1>
      </div>
      <div className="card peach hstack" style={{ marginBottom: 16 }}>
        <span className="list-thumb"><Icon name="wrench" /></span>
        <div className="grow"><b>{problem}</b><p className="small text-2">{pros.length > 1 ? `Demande groupée · ${pros.length} professionnels` : `Envoyée à ${proName(pros[0])}`}</p></div>
      </div>
      <div className="fcard">
        <div className="fcard-head"><Icon name="docFill" /><label htmlFor="d">Décrivez le problème</label></div>
        <div className="finput"><textarea id="d" required minLength={5} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Ex. : la voiture ne démarre plus, voyant batterie allumé…" /></div>
      </div>
      <div className="fcard">
        <div className="fcard-head"><Icon name="carFill" /><label htmlFor="b">Véhicule</label></div>
        {vehicles.data && vehicles.data.length > 0 && (
          <div className="finput" style={{ marginBottom: 10 }}>
            <select aria-label="Mon véhicule" value={f.vehicleId} onChange={(e) => pickVehicle(e.target.value)}>
              <option value="">Autre véhicule</option>
              {vehicles.data.map((v) => <option key={v._id} value={v._id}>{v.brand} {v.model} {v.year ?? ''}</option>)}
            </select>
          </div>
        )}
        <div className="frow">
          <input id="b" required value={f.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Marque" aria-label="Marque" />
          <input required value={f.model} onChange={(e) => set('model', e.target.value)} placeholder="Modèle" aria-label="Modèle" />
          <input type="number" min={1950} max={2100} value={f.year} onChange={(e) => set('year', e.target.value)} placeholder="Année" aria-label="Année" style={{ width: 96, flex: 'none' }} />
        </div>
      </div>
      <div className="fcard">
        <div className="fcard-head"><Icon name="pinFill" /><label htmlFor="a">Adresse / point de repère</label></div>
        <div className="finput"><input id="a" required minLength={3} value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Carrefour, quartier, repère…" /></div>
      </div>
      <div className="fcard">
        <div className="fcard-head"><Icon name="phoneFill" /><label htmlFor="p">Téléphone</label></div>
        <div className="finput"><input id="p" type="tel" required value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
      </div>
      <div className="fcard">
        <div className="fcard-head"><Icon name="calendar" /><label htmlFor="dt">Date souhaitée (facultatif)</label></div>
        <div className="finput"><input id="dt" type="datetime-local" value={f.preferredDate} onChange={(e) => set('preferredDate', e.target.value)} /></div>
      </div>
      <div className="fcard">
        <div className="fcard-head"><Icon name="bolt" /><label>Urgence</label></div>
        <div className="tags">
          {[['high', 'Urgent – je suis bloqué'], ['normal', 'Normale'], ['low', 'Pas pressé']].map(([v, l]) => (
            <button type="button" key={v} className={`opt${f.urgency === v ? ' on' : ''}`} aria-pressed={f.urgency === v} onClick={() => set('urgency', v)}>{l}</button>
          ))}
        </div>
      </div>
      <p className="xs text-2">Votre position exacte n’est transmise qu’aux professionnels sélectionnés.</p>
      <ErrorBox error={error} />
      <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={busy}>{busy ? 'Envoi…' : 'Envoyer la demande'}</button>
    </form>
  );
}

/** Dépannage (maquette 3) puis recherche des professionnels à proximité (liste / carte). */
function Depannage() {
  const sp = useSearchParams();
  const router = useRouter();
  const { user } = useSession();
  const { place, setPicking } = usePlace();
  const initialTrade = sp.get('trade') ?? '';
  const initialProblem = sp.get('problem') ?? '';
  // Le client choisit TOUJOURS son problème d'abord : rien n'est présélectionné, les professionnels
  // compétents n'apparaissent qu'ensuite (un métier reçu en paramètre sert seulement à proposer ses problèmes).
  const [tile, setTile] = useState<string>('');
  const [trade, setTrade] = useState(initialTrade);
  const [problem, setProblem] = useState(initialProblem);
  const categories = useFetch<any[]>('/service-categories');
  const [pos, setPos] = useState<Pos>({ lat: place.lat, lng: place.lng });
  const [view, setView] = useState<'list' | 'map'>('list');
  const [results, setResults] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any[]>([]);
  const [requesting, setRequesting] = useState<any[] | null>(null);
  const wantedPro = sp.get('pro');

  useEffect(() => setPos({ lat: place.lat, lng: place.lng }), [place.lat, place.lng]);
  useEffect(() => {
    if (!trade) return;
    setResults(null);
    setError(null);
    api(`/professionals/search${qs({ trade, lat: pos.lat.toFixed(5), lng: pos.lng.toFixed(5) })}`).then(setResults).catch((e) => setError(e.message));
  }, [pos, trade]);

  const pick = (t: typeof PROBLEMS[number]) => {
    setTile(t.key);
    setProblem(t.problem);
    setSelected([]);
    setTrade(t.trade ?? '');
  };
  const quick = (q: typeof QUICK[number]) => { setTile(''); setTrade(q.trade); setProblem(q.label); setSelected([]); };
  const toggle = (p: any) => setSelected((s) => (s.some((x) => x._id === p._id) ? s.filter((x) => x._id !== p._id) : s.length >= 5 ? s : [...s, p]));
  const startRequest = (list: any[]) => {
    if (!user) return router.push(`/connexion?next=${encodeURIComponent(`/depannage?trade=${trade}&problem=${encodeURIComponent(problem)}`)}`);
    setRequesting(list);
  };
  const items = useMemo(() => {
    const list = results?.items ?? [];
    if (!wantedPro) return list;
    return [...list.filter((p: any) => p._id === wantedPro), ...list.filter((p: any) => p._id !== wantedPro)];
  }, [results, wantedPro]);

  if (requesting) {
    return <RequestForm trade={trade} problem={problem} pos={pos} pros={requesting} onCancel={() => setRequesting(null)} onDone={(id) => router.push(`/compte/demande?id=${id}`)} />;
  }

  const needTrade = tile === 'other' && !trade;

  return (
    <div className="screen">
      <div className="dep-top">
        <div className="dep-head" style={{ backgroundImage: `url(${IMAGES.home.towTruck})` }} role="img" aria-label="Dépanneuse transportant une voiture" />
        <div className="page-head"><BackButton href="/" /></div>
        <h1 className="title-xl" style={{ position: 'relative', fontSize: 26 }}>Dépannage</h1>
        <h2 className="step-title" style={{ position: 'relative', marginTop: 6 }}>1. Quel est le problème ?</h2>
      </div>

      <section>
        <div className="cat-grid">
          {PROBLEMS.map((t) => {
            const on = tile === t.key;
            return (
              <button key={t.key} className={`cat-tile${on ? ' on' : ''}`} aria-pressed={on} onClick={() => pick(t)}>
                {on && <span className="tick"><Icon name="check" /></span>}
                <span className="art"><ImgOr src={t.img} icon={t.icon} alt="" fit="contain" /></span>
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      {wantedPro && !problem && (
        <div className="await-box section"><Icon name="info" /><span><b>Choisissez d’abord votre problème</b><small>Le professionnel que vous avez consulté vous sera proposé en premier s’il peut s’en occuper.</small></span></div>
      )}

      {trade && (categories.data?.find((c) => c.trade === trade)?.problems?.length ?? 0) > 0 && (
        <section className="section">
          <SecHead title={`Précisez : ${TRADES[trade]?.label ?? 'votre problème'}`} />
          <div className="tags">
            {categories.data!.find((c) => c.trade === trade)!.problems.map((pb: any) => (
              <button key={pb.key} className={`opt${problem === pb.label ? ' on' : ''}`} aria-pressed={problem === pb.label} onClick={() => { setProblem(pb.label); setSelected([]); }}>{pb.label}</button>
            ))}
          </div>
        </section>
      )}

      {needTrade && (
        <section className="section">
          <SecHead title="Quel professionnel vous faut-il ?" />
          <div className="tags">{Object.entries(TRADES).map(([k, t]) => <button key={k} className="opt" onClick={() => setTrade(k)}>{t.label}</button>)}</div>
        </section>
      )}

      <section className="section">
        <SecHead title="Options rapides" />
        <div className="tags">
          {QUICK.map((q) => <button key={q.label} className={`opt${problem === q.label ? ' on' : ''}`} aria-pressed={problem === q.label} onClick={() => quick(q)}>{q.label}</button>)}
        </div>
      </section>

      {trade && problem ? (
        <>
          <section className="section">
            <h2 className="step-title">2. Votre position</h2>
            <button className="card hstack" style={{ width: '100%', border: 0, textAlign: 'left' }} onClick={() => setPicking(true)}>
              <span className="list-thumb"><Icon name="pinFill" /></span>
              <span className="grow"><b>{place.label}</b><br /><span className="small text-2">{place.detail} · touchez pour changer (GPS ou commune)</span></span>
              <Icon name="chevR" className="chev" />
            </button>
          </section>

          <section className="section">
            <div className="sec-head">
              <h2>3. {TRADES[trade]?.label ?? 'Professionnels'} à proximité</h2>
              {results && <span className="small text-2">{results.items.length} · {results.radiusKm} km</span>}
            </div>
            <Seg small value={view} onChange={setView} options={[{ value: 'list', label: 'Liste', icon: 'filters' }, { value: 'map', label: 'Carte', icon: 'pin' }]} />
            <div style={{ height: 14 }} />
            {results?.expanded && <div className="alert alert-info small">Rayon élargi automatiquement pour trouver plus de professionnels.</div>}
            {view === 'map' && <><Map center={pos} pros={items} onMove={setPos} height={340} /><p className="xs text-2" style={{ margin: '8px 0 14px' }}>Déplacez votre marqueur sur la carte pour préciser votre position.</p></>}
            <ErrorBox error={error} />
            {!results && !error && <Loading rows={2} height={300} />}
            {results && items.length === 0 && <Empty icon="users" title="Aucun professionnel disponible pour le moment">Essayez une autre option ou revenez un peu plus tard.</Empty>}
            <div className="stack" style={{ gap: 16 }}>
              {items.map((p: any) => {
                const sel = selected.some((s) => s._id === p._id);
                return (
                  <div key={p._id}>
                    <ProCoverCard p={p} onRequest={(x) => startRequest([x])} />
                    <button className={`select-line${sel ? ' on' : ''}`} onClick={() => toggle(p)} aria-pressed={sel}>
                      <span className="box">{sel && <Icon name="check" />}</span>Ajouter à une demande groupée (jusqu’à 5)
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      <section className="section"><AssistBanner cta="Contacter" /></section>

      {selected.length > 0 && (
        <div className="sticky-actions single">
          <button className="btn btn-primary" disabled={selected.length < 2} onClick={() => startRequest(selected)}>
            {selected.length < 2 ? 'Sélectionnez au moins 2 professionnels' : `Envoyer la demande groupée (${selected.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense><Depannage /></Suspense>;
}

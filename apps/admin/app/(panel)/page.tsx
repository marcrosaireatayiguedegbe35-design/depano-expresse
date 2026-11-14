'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Card, ErrorBox, PageHeader, useFetch } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useCan } from '@/components/admin-context';
import { fcfa, num, TRADES } from '@/lib/format';

const COLORS = ['#0b4ea2', '#4aa3f0', '#f5b400', '#10a779', '#6f93cc'];

const smoothPath = (P: [number, number][]) => {
  let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
};

const short = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1).replace('.', ',')} M` : v >= 1e3 ? `${Math.round(v / 1e3)} k` : String(Math.round(v)));
const niceTop = (mx: number) => { const p = 10 ** Math.floor(Math.log10(Math.max(1, mx))); return Math.ceil(mx / p) * p; };

/** Mini-courbe des cartes KPI (spark2 de Canaan). */
function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const W = 120, H = 40, mx = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 4 - (v / mx) * (H - 8)] as [number, number]);
  const d = smoothPath(pts);
  const id = `sg${color.slice(1)}`;
  return (
    <svg className="spark2" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${d}L${W} ${H}L0 ${H}Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function KpiCard({ icon, tone, label, value, unit, foot, spark, color }: {
  icon: string; tone: string; label: string; value: string; unit?: string; foot: React.ReactNode; spark?: number[]; color: string;
}) {
  return (
    <div className="kc">
      <span className={`kc-ico kc-${tone}`}><Icon name={icon} className="" /></span>
      <div className="kc-body">
        <span className="kc-label">{label}</span>
        <span className="kc-value">{value}{unit && <> <small>{unit}</small></>}</span>
        <div className="kc-foot"><span className="kc-vs">{foot}</span>{spark && <Spark values={spark} color={color} />}</div>
      </div>
    </div>
  );
}

/** Graphique d'évolution (même rendu que « Évolution du chiffre d’affaires » de Canaan). */
function EvoChart({ days }: { days: { date: string; revenue: number; commission: number }[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(700);
  const [hover, setHover] = useState(days.length - 1);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, Math.floor(e.contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const H = 230, L = 46, R = 12, T = 14, B = 26;
  const top = niceTop(Math.max(1, ...days.map((d) => d.revenue)));
  const x = (i: number) => L + (days.length < 2 ? 0 : (i * (W - L - R)) / (days.length - 1));
  const y = (v: number) => T + (H - B - T) * (1 - v / top);
  const rev = smoothPath(days.map((d, i) => [x(i), y(d.revenue)]));
  const com = smoothPath(days.map((d, i) => [x(i), y(d.commission)]));
  const h = days[hover];
  return (
    <div className="evo-box" ref={box}>
      <svg className="chart2 evo-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) * W) / r.width;
          setHover(Math.max(0, Math.min(days.length - 1, Math.round(((px - L) / (W - L - R)) * (days.length - 1)))));
        }}
        onMouseLeave={() => setHover(days.length - 1)}>
        <defs><linearGradient id="evoG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a74d8" stopOpacity=".22" /><stop offset="1" stopColor="#1a74d8" stopOpacity="0" /></linearGradient></defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(top * f)} y2={y(top * f)} stroke="#e8eff7" strokeDasharray={f ? '3 4' : undefined} />
            <text x={L - 8} y={y(top * f) + 3} textAnchor="end">{short(top * f)}</text>
          </g>
        ))}
        {days.map((d, i) => (i % Math.ceil(days.length / 8) === 0 || i === days.length - 1) && (
          <text key={d.date} x={x(i)} y={H - 6} textAnchor="middle">{d.date.slice(8)}/{d.date.slice(5, 7)}</text>
        ))}
        <path d={`${rev}L${x(days.length - 1)} ${y(0)}L${x(0)} ${y(0)}Z`} fill="url(#evoG)" />
        <path d={rev} fill="none" stroke="#1a74d8" strokeWidth="2.4" strokeLinecap="round" />
        <path d={com} fill="none" stroke="#f5b400" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 4" />
        <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#cfdcec" />
        <circle cx={x(hover)} cy={y(h.revenue)} r="5" fill="#fff" stroke="#1a74d8" strokeWidth="2.5" />
      </svg>
      <div className="evo-tip" style={{ left: Math.min(Math.max(x(hover) - 70, 4), W - 170), top: Math.max(y(h.revenue) - 70, 0) }}>
        <b>{new Date(h.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</b>
        <span><i />{fcfa(h.revenue)}</span>
        <span><i style={{ background: '#f5b400' }} />Commission {fcfa(h.commission)}</span>
      </div>
    </div>
  );
}

/** Anneau épais « Répartition » de Canaan. */
function Ring({ slices }: { slices: { v: number; c: string }[] }) {
  const total = slices.reduce((s, x) => s + x.v, 0) || 1;
  const r = 40, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#eef4fb" strokeWidth="14" />
      {slices.map((s, i) => {
        const len = (s.v / total) * C;
        const el = <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={s.c} strokeWidth="14" strokeDasharray={`${Math.max(0, len - 1.2)} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 50 50)" />;
        acc += len;
        return el;
      })}
    </svg>
  );
}

export default function DashboardPage() {
  const can = useCan();
  const { data, error } = useFetch<any>(can('dashboard.read') ? '/dashboard' : null);
  if (!can('dashboard.read')) return <PageHeader welcome title="Depanno Expresse" subtitle="Utilisez le menu pour accéder à vos modules." />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return <p className="muted">Chargement…</p>;
  const { counts: c, finance: f, last30Days: days, byTrade } = data;
  const rev30 = days.reduce((s: number, d: any) => s + d.revenue, 0);
  const com30 = days.reduce((s: number, d: any) => s + d.commission, 0);
  const firstHalf = days.slice(0, 15).reduce((s: number, d: any) => s + d.revenue, 0);
  const secondHalf = days.slice(15).reduce((s: number, d: any) => s + d.revenue, 0);
  const trend = firstHalf ? Math.round(((secondHalf - firstHalf) / firstHalf) * 1000) / 10 : null;
  const tradeTotal = byTrade.reduce((s: number, t: any) => s + t.revenue, 0);
  const verifiedShare = c.professionals ? Math.round((c.verifiedPros / c.professionals) * 100) : 0;
  const insight = trend === null
    ? 'Pas encore assez d’historique pour comparer les deux dernières quinzaines.'
    : `Les encaissements des 15 derniers jours sont en ${trend >= 0 ? 'hausse' : 'baisse'} de ${String(Math.abs(trend)).replace('.', ',')} % par rapport à la quinzaine précédente.`;
  const activity = [
    { l: 'Interventions terminées', v: c.completed, t: c.interventions, icon: 'check', color: '#10a779' },
    { l: 'Demandes en attente', v: c.pendingRequests, t: c.interventions, icon: 'clock', color: '#0b4ea2' },
    { l: 'Factures à valider (clients)', v: c.invoicesAwaiting, t: c.interventions, icon: 'doc', color: '#f5b400' },
    { l: 'Litiges ouverts', v: c.openDisputes, t: c.interventions, icon: 'alert', color: '#c0392b' },
  ];
  const maxAct = Math.max(1, ...activity.map((a) => a.v));

  return (
    <>
      <PageHeader welcome title="Depanno Expresse Manager" subtitle="Suivez les interventions, les professionnels et les finances en temps réel."
        slogan={<>Chaque panne a sa solution,<br />chaque franc sa trace</>} />

      <div className="kc-grid">
        <KpiCard icon="coins" tone="blue" label="Encaissé (30 jours)" value={num(rev30)} unit="FCFA" color="#0756a5"
          foot={trend === null ? 'sans comparaison' : <span className={`kc-trend${trend < 0 ? ' down' : ''}`}>{trend >= 0 ? '↑' : '↓'} {String(Math.abs(trend)).replace('.', ',')} % <span className="kc-vs">vs quinzaine préc.</span></span>}
          spark={days.slice(-10).map((d: any) => d.revenue)} />
        <KpiCard icon="percent" tone="green" label="Commissions (20 %)" value={num(f.commissions)} unit="FCFA" color="#10a779"
          foot={`${fcfa(com30)} sur 30 jours`} spark={days.slice(-10).map((d: any) => d.commission)} />
        <KpiCard icon="cash" tone="sky" label="Reversements effectués" value={num(f.payoutsPaid)} unit="FCFA" color="#35a4dd"
          foot={f.payoutsPending ? `${fcfa(f.payoutsPending)} en attente` : 'Aucun en attente'} />
        <div className="kc">
          <span className="kc-ico kc-gold"><Icon name="wrench" className="" /></span>
          <div className="kc-body">
            <span className="kc-label">Professionnels vérifiés</span>
            <span className="kc-value">{num(c.verifiedPros)} <small>/ {num(c.professionals)}</small></span>
            <span className="kc-sub">{c.pendingPros ? <Link href="/professionnels?status=pending">{c.pendingPros} en attente de vérification</Link> : 'Aucune vérification en attente'}</span>
            <span className="kc-bar"><i style={{ width: `${verifiedShare}%` }} /></span>
          </div>
        </div>
      </div>

      <div className="dash-row">
        <Card className="dash-chart" icon="trend" title="Évolution des encaissements" subtitle="30 derniers jours (en FCFA) · interventions payées">
          <EvoChart days={days} />
          <div className="evo-foot">
            <div className="ef"><span className="ef-ic"><Icon name="coins" className="" /></span><div><small>Total encaissé (période)</small><b>{fcfa(rev30)}</b></div></div>
            <div className="ef"><span className="ef-ic"><Icon name="percent" className="" /></span><div><small>Commission plateforme (période)</small><b className="pos">{fcfa(com30)}</b></div></div>
          </div>
        </Card>
        <Card className="dash-donut" icon="pie" title="Répartition par métier" subtitle="Encaissements cumulés (en FCFA)">
          {tradeTotal ? (
            <div className="dn2">
              <div className="dn2-ring">
                <Ring slices={byTrade.map((t: any, i: number) => ({ v: t.revenue, c: COLORS[i % COLORS.length] }))} />
                <span className="dn2-c"><b>{short(tradeTotal)}</b><small>FCFA</small></span>
              </div>
              <ul className="dn2-leg">
                {byTrade.map((t: any, i: number) => (
                  <li key={t._id}><i style={{ background: COLORS[i % COLORS.length] }} /><div><span>{TRADES[t._id] ?? t._id}</span><br /><b>{fcfa(t.revenue)}</b></div><em>{Math.round((t.revenue / tradeTotal) * 100)} %</em></li>
                ))}
              </ul>
            </div>
          ) : <p className="muted">Aucun paiement pour le moment.</p>}
        </Card>
      </div>

      <div className="dash-row dash-row2">
        <Card className="dash-last" icon="truck" title="Activité des interventions" subtitle={`${num(c.interventions)} interventions au total`}
          actions={<Link className="link-all" href="/interventions">Voir tout <Icon name="arrow" className="" /></Link>}>
          <div className="ct">
            {activity.map((a) => (
              <div key={a.l} className="ct-row">
                <span className="ct-ic" style={{ color: a.color }}><Icon name={a.icon} className="" /></span>
                <div className="ct-mid">
                  <div className="ct-top"><span>{a.l}</span><em>{num(a.v)}</em></div>
                  <span className="ct-bar"><i style={{ width: `${Math.max(3, (a.v / maxAct) * 100)}%`, background: a.color }} /></span>
                </div>
                <b>{num(a.v)}</b>
              </div>
            ))}
          </div>
        </Card>
        <div className="dash-side">
          <Card icon="cart" title="Commerce & annuaire" subtitle="Marketplace, entreprises et publicités">
            <div className="ct">
              {[
                ['Commandes à traiter', `${num(c.pendingOrders)} / ${num(c.orders)}`, '/commandes'],
                ['Produits publiés', num(c.products), '/produits'],
                ['Entreprises validées', num(c.companies), '/entreprises'],
                ['Campagnes actives', num(c.activeAds), '/publicites'],
              ].map(([l, v, href]) => (
                <div key={l} className="ct-row"><div className="ct-mid"><div className="ct-top"><Link href={href}>{l}</Link></div></div><b>{v}</b></div>
              ))}
            </div>
          </Card>
          <section className="panel retain">
            <span className="rt-ico"><Icon name="bulb" className="" /></span>
            <div><b>À retenir</b><p>{insight}</p></div>
            <span className="rt-tr"><Icon name="trend" className="" /></span>
          </section>
        </div>
      </div>
    </>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { AdminCtx, Me } from '@/components/admin-context';
import { Icon } from '@/components/icons';
import { NAV, NavItem, SectionCtx } from '@/components/nav';
import { TradesLoader } from '@/components/trades';
import { useOpsAlerts } from '@/components/ops-alerts';
import { useToast } from '@/components/ui';

const initialsOf = (name: string) => name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [pop, setPop] = useState<null | 'user' | 'bell'>(null);
  const [search, setSearch] = useState('');
  const [searchMiss, setSearchMiss] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<{ disputes: number; pros: number; invoices: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [alertTick, setAlertTick] = useState(0);
  const [unseen, setUnseen] = useState(0);
  const ops = useOpsAlerts(!!me?.permissions.includes('dashboard.read') && !me?.mustChangePassword, (e) => {
    toast(`🔔 ${e.title}${e.body ? ` – ${e.body}` : ''}`, 'success', 10_000);
    setAlertTick((t) => t + 1);
    setUnseen((n) => n + 1);
  });

  useEffect(() => {
    api<Me>('/auth/me')
      .then((m) => {
        setMe(m);
        if (m.mustChangePassword && pathname !== '/compte') router.replace('/compte?first=1');
      })
      .catch(() => router.replace('/login'));
  }, [pathname, router]);

  useEffect(() => { setNavOpen(false); setPop(null); }, [pathname]);

  useEffect(() => {
    if (!me?.permissions.includes('dashboard.read')) return;
    api('/dashboard').then((d) => setAlerts({ disputes: d.counts.openDisputes, pros: d.counts.pendingPros, invoices: d.counts.invoicesAwaiting })).catch(() => {});
  }, [me, pathname, alertTick]);

  useEffect(() => {
    // React écoute aussi sur document : on ignore les clics sur les déclencheurs et dans la fenêtre.
    const close = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest('.pop, .tb2-bell, .tb2-user')) return;
      setPop(null);
    };
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') setPop(null);
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', key); };
  }, []);

  if (!me) return <div className="boot">Chargement…</div>;

  const allowed = (i: NavItem) => !me.mustChangePassword ? (!i.perm || me.permissions.includes(i.perm)) : i.href === '/compte';
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const section = NAV.find((g) => g.items.some((i) => isActive(i.href)))?.group ?? 'Administration';
  const initials = initialsOf(me.name);
  const dateLong = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const alertCount = alerts ? alerts.disputes + alerts.pros + alerts.invoices : 0;
  // Nombre affiché sur la cloche : points d'attention + nouvelles opérations non consultées. Rien si zéro.
  const badge = alertCount + unseen;

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
  };

  const runSearch = () => {
    const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const q = norm(search);
    if (!q) return;
    const hit = NAV.flatMap((g) => g.items).filter(allowed).find((i) => norm(i.label).includes(q));
    if (hit) { setSearch(''); setSearchMiss(null); router.push(hit.href); }
    else { setSearch(''); setSearchMiss(`Aucun résultat pour « ${q} »`); }
  };

  let first = true;
  return (
    <AdminCtx.Provider value={me}>
      <SectionCtx.Provider value={section}>
        <div className={`app-shell shell2 ${navOpen ? 'nav-open' : ''}`}>
          <aside className="sidebar" aria-label="Navigation">
            <div className="sb-brand">
              <img src="/logo.svg" alt="" width={52} height={52} />
              <span><strong>PLATEFORME AUTO</strong><small>Administration</small></span>
            </div>
            <nav className="side-nav">
              {NAV.map((g) => {
                const items = g.items.filter(allowed);
                if (!items.length) return null;
                const divider = !first;
                first = false;
                return (
                  <div key={g.group} style={{ display: 'contents' }}>
                    {divider && <div className="side-nav-divider" />}
                    <p className="side-nav-group">{g.group}</p>
                    {items.map((i) => (
                      <Link key={i.href} href={i.href} className={`side-nav-link${isActive(i.href) ? ' is-active' : ''}`} style={{ textDecoration: 'none' }}>
                        <Icon name={i.icon} className="side-nav-ico" /><span>{i.label}</span>
                      </Link>
                    ))}
                  </div>
                );
              })}
            </nav>
            <div className="sidebar-footer">
              <div className="user-chip">
                <span className="user-avatar" aria-hidden="true">{initials}</span>
                <span className="user-meta"><span className="user-name">{me.name}</span><span className="user-role">{me.roleLabel}</span></span>
                <button className="btn-logout" onClick={logout}>Se déconnecter</button>
              </div>
            </div>
          </aside>
          <button className="sidebar-backdrop" aria-label="Fermer le menu" onClick={() => setNavOpen(false)} />

          <div className="main main2">
            <div className="topbar2">
              <label className="tb2-search" style={{ margin: 0 }}>
                <Icon name="search" />
                <input ref={searchRef} type="search" value={search} placeholder={searchMiss ?? 'Rechercher une page… (Ctrl + K)'} autoComplete="off" aria-label="Rechercher"
                  onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }} />
              </label>
              <button type="button" className="tb2-bell" aria-label="Points d’attention" onClick={(e) => { e.stopPropagation(); setPop(pop === 'bell' ? null : 'bell'); setUnseen(0); }}>
                <Icon name="bell" />{badge > 0 && <span className="bell-count" aria-label={`${badge} alerte(s)`}>{badge > 99 ? '99+' : badge}</span>}
              </button>
              <span className="tb2-date"><Icon name="cal" /><span>{dateLong}</span></span>
              <button type="button" className="tb2-user" aria-haspopup="true" aria-expanded={pop === 'user'} onClick={(e) => { e.stopPropagation(); setPop(pop === 'user' ? null : 'user'); }}>
                <span className="user-avatar" aria-hidden="true">{initials}</span>
                <span className="tb2-meta"><strong>{me.name}</strong><small>{me.roleLabel}</small></span>
                <i className="tb2-chev" />
              </button>
              {pop === 'user' && (
                <div className="pop pop-user" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => router.push('/compte')}><Icon name="lock" />Mon compte</button>
                  <button type="button" onClick={logout}><Icon name="logout" />Se déconnecter</button>
                </div>
              )}
              {pop === 'bell' && (
                <div className="pop pop-bell" onClick={(e) => e.stopPropagation()}>
                  <div className="pop-snd">
                    <label className="check"><input type="checkbox" checked={ops.soundOn} onChange={(e) => ops.setSoundOn(e.target.checked)} /> Alerte sonore à chaque opération</label>
                    <button type="button" className="btn btn-sm" onClick={ops.test}>Tester</button>
                  </div>
                  <p className="small" style={{ margin: '.2rem 0 .6rem', color: ops.connected ? '#0d8a62' : '#a86b00' }}>
                    {ops.connected ? '● Temps réel connecté' : '● Reconnexion au temps réel…'}
                  </p>
                  {ops.events.length > 0 && (
                    <>
                      <p className="pop-h">Dernières opérations</p>
                      {ops.events.slice(0, 5).map((e, i) => (
                        <div key={i} className="pop-row"><b>{e.title}</b><span>{e.body ?? ''}</span><em>{new Date(e.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</em></div>
                      ))}
                    </>
                  )}
                  <p className="pop-h" style={{ marginTop: '.6rem' }}>Points d’attention</p>
                  {!alerts ? <p className="muted" style={{ margin: '.4rem 0' }}>Aucune donnée.</p> : (
                    <>
                      <Link className="pop-row" href="/litiges" style={{ textDecoration: 'none' }}><b>Litiges ouverts</b><span>Paiements suspendus</span><em>{alerts.disputes}</em></Link>
                      <Link className="pop-row" href="/professionnels?status=pending" style={{ textDecoration: 'none' }}><b>Professionnels à vérifier</b><span>En attente de validation</span><em>{alerts.pros}</em></Link>
                      <Link className="pop-row" href="/finance?tab=invoices" style={{ textDecoration: 'none' }}><b>Factures à valider</b><span>En attente du client</span><em>{alerts.invoices}</em></Link>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="mobile-bar">
              <button className="nav-toggle" aria-label="Menu" onClick={() => setNavOpen((o) => !o)}><Icon name="menu" className="" /></button>
              <span className="mobile-bar-brand"><img src="/logo.svg" alt="" />PLATEFORME AUTO</span>
              <span className="user-avatar">{initials}</span>
            </div>
            <div className="content"><TradesLoader>{children}</TradesLoader></div>
          </div>
        </div>
      </SectionCtx.Provider>
    </AdminCtx.Provider>
  );
}

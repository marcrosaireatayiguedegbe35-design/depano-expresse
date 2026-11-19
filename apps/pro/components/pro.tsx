'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { api, WELCOME_KEY } from '@/lib/api';
import { fcfa, LINE_TYPES, proName, TRADES } from '@/lib/format';
import { IMAGES } from '@/lib/images';
import { Icon } from './icons';
import { useSession } from './session';
import { Loading, useFetch, useToast } from './ui';

const TABS = [
  { href: '/', label: 'Accueil', icon: 'home', iconOn: 'homeFill' },
  { href: '/demandes', label: 'Demandes', icon: 'clipboard', iconOn: 'clipboard' },
  { href: '/interventions', label: 'Interventions', icon: 'wrench', iconOn: 'wrench' },
  { href: '/gains', label: 'Gains', icon: 'card', iconOn: 'cardFill' },
  { href: '/profil', label: 'Profil', icon: 'user', iconOn: 'userFill' },
];
const PUBLIC = ['/bienvenue', '/connexion', '/inscription', '/mot-de-passe-oublie'];
/** Pages accessibles avant la signature du contrat (le reste renvoie vers /contrat). */
const BEFORE_CONTRACT = ['/contrat', '/aide', '/profil/securite', '/notifications'];

/** Barre de navigation inférieure de l'espace professionnels (même style que l'espace client). */
export function TabBar() {
  const pathname = usePathname();
  const { pro, unread } = useSession();
  if (!pro || PUBLIC.some((p) => pathname.startsWith(p)) || !pro.contractSigned) return null;
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href.replace(/s$/, '')) || (href === '/demandes' && pathname.startsWith('/message')) || (href === '/profil' && pathname.startsWith('/notifications')));
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {TABS.map((t) => {
        const on = active(t.href);
        return (
          <Link key={t.href} href={t.href} className={`tab${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined}>
            <Icon name={on ? t.iconOn : t.icon} />
            <span>{t.label}</span>
            {t.href === '/profil' && unread > 0 && !on && <span className="b">{unread > 9 ? '9+' : unread}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** Protège les pages connectées : sans session, renvoie vers Bienvenue / Connexion. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { pro, loading } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC.some((p) => pathname.startsWith(p));
  useEffect(() => {
    if (loading || pro || isPublic) return;
    let seen = false;
    try { seen = !!localStorage.getItem(WELCOME_KEY); } catch {}
    router.replace(seen ? `/connexion?next=${encodeURIComponent(pathname)}` : '/bienvenue');
  }, [loading, pro, isPublic, pathname, router]);
  const needsContract = !!pro && !pro.contractSigned && !isPublic && !BEFORE_CONTRACT.some((p) => pathname.startsWith(p));
  useEffect(() => { if (needsContract) router.replace('/contrat'); }, [needsContract, router]);
  if ((!isPublic && !pro) || needsContract) return <div className="screen"><Loading rows={3} /></div>;
  return <>{children}</>;
}

const AVAIL: Record<string, { label: string; cls: string }> = {
  available: { label: 'Disponible', cls: 'ok' },
  busy: { label: 'Occupé', cls: 'busy' },
  unavailable: { label: 'Indisponible', cls: 'off' },
};

/** En-tête : emblème, nom, statut de disponibilité modifiable et notifications. */
/** Accès rapide aux messages des clients, avec le nombre de demandes à accepter et de messages non lus. */
function MessagesButton() {
  const { data } = useFetch<any>('/conversations/unread');
  const n = (data?.pending ?? 0) + (data?.unread ?? 0);
  return (
    <Link href="/demandes?tab=contacts" className="round-btn" aria-label={`Messages clients${n ? `, ${n} en attente` : ''}`}>
      <Icon name="chat" />{n > 0 && <span className="count">{n > 9 ? '9+' : n}</span>}
    </Link>
  );
}

export function ProTopbar() {
  const { pro, setPro, unread } = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  if (!pro) return null;
  const a = AVAIL[pro.availability] ?? AVAIL.unavailable;
  const change = async (v: string) => {
    setOpen(false);
    try {
      const r = await api('/auth/availability', { method: 'PATCH', body: { availability: v } });
      setPro({ ...pro, availability: r.availability });
      toast(`Statut : ${AVAIL[r.availability].label}`);
    } catch (e: any) { toast(e.message, 'danger'); }
  };
  return (
    <div className="topbar">
      <span className="brand-dot">{pro.photoUrl ? <img src={pro.photoUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : <img src={IMAGES.brand.logo} alt="Depanno Expresse" />}</span>
      <div className="grow" style={{ position: 'relative' }}>
        <strong className="pro-name">{proName(pro)}</strong>
        <button className={`avail-pill ${a.cls}`} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
          <i />{a.label}<Icon name="chevD" />
        </button>
        {open && (
          <div className="avail-menu" role="menu">
            {Object.entries(AVAIL).map(([k, v]) => (
              <button key={k} role="menuitem" className={k === pro.availability ? 'on' : ''} onClick={() => change(k)}><i className={v.cls} />{v.label}</button>
            ))}
          </div>
        )}
      </div>
      <MessagesButton />
      <Link href="/notifications" className="round-btn" aria-label={`Notifications${unread ? `, ${unread} non lues` : ''}`}>
        <Icon name="bell" />{unread > 0 && <span className="count">{unread > 9 ? '9+' : unread}</span>}
      </Link>
    </div>
  );
}

/** Bandeau d'état du compte tant qu'il n'est pas validé par l'administration. */
export function VerificationBanner() {
  const { pro } = useSession();
  if (!pro || pro.verificationStatus === 'validated') return null;
  const msg: Record<string, [string, string]> = {
    pending: ['Compte en attente de vérification', 'Déposez toutes les pièces demandées pour être validé et recevoir des demandes.'],
    in_review: ['Documents en cours de vérification', 'Notre équipe examine vos documents. Vous serez notifié dès la validation.'],
    rejected: ['Vérification refusée', 'Consultez les pièces refusées et déposez des documents conformes.'],
    suspended: ['Compte suspendu', 'Contactez l’assistance.'],
  };
  const [t, d] = msg[pro.verificationStatus] ?? msg.pending;
  return (
    <Link href="/profil/documents" className="verif-banner">
      <span className="ic"><Icon name="shieldFill" /></span>
      <span className="grow"><b>{t}</b><small>{d}</small></span>
      <Icon name="chevR" className="chev" />
    </Link>
  );
}

/** Envoi direct d'une image vers Cloudinary (signature fournie par l'API pro). */
export async function uploadImage(file: File, folder: 'photos' | 'documents' | 'invoices'): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Seules les images sont acceptées');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image trop lourde (5 Mo maximum)');
  const sig = await api('/uploads/signature', { method: 'POST', body: { folder } });
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', sig.timestamp);
  form.append('folder', sig.folder);
  form.append('signature', sig.signature);
  const res = await fetch(sig.uploadUrl, { method: 'POST', body: form });
  if (!res.ok) throw new Error("Échec de l'envoi de l'image");
  return (await res.json()).secure_url;
}

/** Sélecteur de photos (plusieurs) avec aperçus. */
export function PhotoPicker({ value, onChange, folder, max = 6, label }: { value: string[]; onChange: (v: string[]) => void; folder: 'photos' | 'documents' | 'invoices'; max?: number; label: string }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <div>
      <p className="small" style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>{label}</p>
      <div className="photo-row">
        {value.map((u) => (
          <span key={u} className="photo-th"><img src={u} alt="" /><button type="button" aria-label="Retirer" onClick={() => onChange(value.filter((x) => x !== u))}><Icon name="close" /></button></span>
        ))}
        {value.length < max && (
          <label className="photo-add">
            {busy ? '…' : <Icon name="plus" />}
            <input type="file" accept="image/*" hidden disabled={busy} onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (!f) return;
              setBusy(true);
              try { onChange([...value, await uploadImage(f, folder)]); } catch (err: any) { toast(err.message, 'danger'); } finally { setBusy(false); }
            }} />
          </label>
        )}
      </div>
    </div>
  );
}

export interface Line { type: string; label: string; quantity: number; unitPrice: number }

/** Éditeur de lignes (devis / facture) : type, libellé, quantité, prix unitaire, total. */
export function LinesEditor({ lines, onChange }: { lines: Line[]; onChange: (l: Line[]) => void }) {
  const set = (i: number, patch: Partial<Line>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0);
  return (
    <div className="lines">
      {lines.map((l, i) => (
        <div key={i} className="line-card">
          <div className="hstack">
            <select aria-label="Type" value={l.type} onChange={(e) => set(i, { type: e.target.value })}>
              {Object.entries(LINE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button type="button" className="line-x" aria-label="Supprimer la ligne" onClick={() => onChange(lines.filter((_, j) => j !== i))}><Icon name="trash" /></button>
          </div>
          <input aria-label="Libellé" required minLength={2} value={l.label} placeholder="Libellé (ex. : remplacement plaquettes)" onChange={(e) => set(i, { label: e.target.value })} />
          <div className="hstack">
            <label className="mini">Qté<input type="number" min={1} required value={l.quantity || ''} onChange={(e) => set(i, { quantity: Number(e.target.value) })} /></label>
            <label className="mini grow">Prix unitaire (FCFA)<input type="number" min={0} required value={Number.isFinite(l.unitPrice) ? l.unitPrice : ''} onChange={(e) => set(i, { unitPrice: Number(e.target.value) })} /></label>
            <b className="line-total">{fcfa((l.quantity || 0) * (l.unitPrice || 0))}</b>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-light btn-block btn-sm" onClick={() => onChange([...lines, { type: 'labor', label: '', quantity: 1, unitPrice: 0 }])}><Icon name="plus" />Ajouter une ligne</button>
      <div className="card peach total-line" style={{ marginTop: 12 }}><span>Total</span><span className="price">{fcfa(total)}</span></div>
      <p className="xs text-2" style={{ marginTop: 6 }}>Les pièces détachées et frais externes ne sont pas soumis à la commission de la plateforme.</p>
    </div>
  );
}

export const tradeLabel = (t?: string) => (t ? TRADES[t]?.label ?? t : '');

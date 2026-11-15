'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, qs, uploadImage } from '@/lib/api';
import { STATUS } from '@/lib/format';
import { Icon } from './icons';
import { useSection } from './nav';
import { LogoLoading } from './brand-loader';

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

type Toast = { id: number; text: string; tone: 'success' | 'danger' };
const ToastCtx = createContext<(text: string, tone?: Toast['tone'], ms?: number) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'success', ms = 4500) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Données paginées                                                    */
/* ------------------------------------------------------------------ */

export interface PageData<T> { items: T[]; total: number; page: number; limit: number }

/** Rappelle `reload` (sans écran de chargement) dès qu'une opération est signalée en temps réel. */
export function useLiveReload(reload: () => void) {
  const ref = useRef(reload);
  ref.current = reload;
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = () => { clearTimeout(t); t = setTimeout(() => ref.current(), 400); };
    window.addEventListener('pa:ops', on);
    return () => { window.removeEventListener('pa:ops', on); clearTimeout(t); };
  }, []);
}

export function useList<T = any>(path: string, initial: Record<string, unknown> = {}) {
  const [params, setParams] = useState<Record<string, unknown>>({ page: 1, limit: 20, ...initial });
  const [data, setData] = useState<PageData<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(params);

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await api<PageData<T>>(path + qs(params)));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key]);

  useEffect(() => { reload(); }, [reload]);
  useLiveReload(() => reload(true));

  const set = (patch: Record<string, unknown>) => setParams((p) => ({ ...p, page: 1, ...patch }));
  return { data, error, loading, params, set, setPage: (page: number) => setParams((p) => ({ ...p, page })), reload };
}

export function useFetch<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!path) return;
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [path]);
  useEffect(() => { reload(); }, [reload]);
  useLiveReload(reload);
  return { data, error, reload };
}

/* ------------------------------------------------------------------ */
/* Mise en page                                                        */
/* ------------------------------------------------------------------ */

/** En-tête « bienvenue » du design Canaan : surtitre (groupe de menu), titre, sous-titre, actions. */
export function PageHeader({ title, subtitle, actions, welcome, slogan }: {
  title: string; subtitle?: string; actions?: ReactNode; welcome?: boolean; slogan?: ReactNode;
}) {
  const section = useSection();
  return (
    <header className={`page-header welcome${welcome ? '' : ' wl-page'}`}>
      <div className="wl-txt">
        <small>{welcome ? 'BIENVENUE SUR VOTRE ESPACE' : section.toUpperCase()}</small>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="wl-right">
        {slogan && <p className="wl-slogan">{slogan}</p>}
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </header>
  );
}

/** Panneau : avec icône → en-tête « ph-plain » de Canaan ; sinon titre à liseré doré. */
export function Card({ title, subtitle, icon, children, actions, className = '' }: {
  title?: string; subtitle?: string; icon?: string; children: ReactNode; actions?: ReactNode; className?: string;
}) {
  return (
    <section className={`card panel ${className}`}>
      {icon && title ? (
        <div className="panel-head ph ph-plain">
          <span className="phi phi-tile"><Icon name={icon} className="" /></span>
          <div className="ph-txt"><h2 className="panel-title">{title}</h2>{subtitle && <p className="muted">{subtitle}</p>}</div>
          {actions}
        </div>
      ) : (title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const STAT_ICON: [RegExp, string, string][] = [
  [/litige|échou|contest/i, 'alert', 'red'],
  [/commission|marge/i, 'percent', 'green'],
  [/rembours/i, 'cash', 'purple'],
  [/reversement/i, 'coins', 'sky'],
  [/ca |chiffre|paiement|payé|encaiss|revenu|valid/i, 'coins', 'blue'],
  [/professionnel|vérifi/i, 'wrench', 'blue'],
  [/client/i, 'users', 'sky'],
  [/intervention|demande/i, 'truck', 'gold'],
  [/facture/i, 'doc', 'gold'],
  [/commande/i, 'cart', 'sky'],
  [/produit/i, 'tag', 'green'],
  [/entreprise/i, 'building', 'blue'],
  [/campagne|publicit/i, 'megaphone', 'gold'],
];

/** Carte KPI « kc » de Canaan (icône ronde en dégradé, libellé, valeur, pied). */
export function Stat({ label, value, hint, tone, icon }: {
  label: string; value: ReactNode; hint?: ReactNode; tone?: 'danger' | 'warning' | 'success'; icon?: string;
}) {
  const match = STAT_ICON.find(([rx]) => rx.test(label));
  const color = tone === 'danger' ? 'red' : tone === 'warning' ? 'gold' : tone === 'success' ? 'green' : match?.[2] ?? 'blue';
  return (
    <div className="kc">
      <span className={`kc-ico kc-${color}`}><Icon name={icon ?? match?.[1] ?? 'chart'} className="" /></span>
      <div className="kc-body">
        <span className="kc-label">{label}</span>
        <span className="kc-value">{value}</span>
        {hint && <span className="kc-sub">{hint}</span>}
      </div>
    </div>
  );
}

export function Badge({ status, children }: { status?: string; children?: ReactNode }) {
  const [label, tone] = (status && STATUS[status]) || [status ?? '—', 'neutral'];
  return <span className={`badge badge-${tone}`}>{children ?? label}</span>;
}

export function ErrorBox({ error }: { error?: string | null }) {
  if (!error) return null;
  return <div className="alert alert-danger" role="alert">{error}</div>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'tab active' : 'tab'} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {items.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v ?? '—'}</dd></div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* Tableaux                                                            */
/* ------------------------------------------------------------------ */

export interface Column<T> { key: string; label: string; render?: (row: T) => ReactNode; align?: 'right' }

export function Table<T extends { _id?: string }>({ columns, rows, onRowClick, empty = 'Aucun élément' }: {
  columns: Column<T>[]; rows?: T[]; onRowClick?: (row: T) => void; empty?: string;
}) {
  return (
    <div className="table-wrap">
      <table className="t2">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.align === 'right' ? 'right' : ''}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {!rows ? (
            <tr><td colSpan={columns.length}><Loading compact /></td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="muted center">{empty}</td></tr>
          ) : (
            rows.map((r, i) => (
              <tr key={r._id ?? i} className={onRowClick ? 'clickable' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={c.align === 'right' ? 'right' : ''}>{c.render ? c.render(r) : (r as any)[c.key] ?? '—'}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ data, onPage }: { data: PageData<unknown> | null; onPage: (p: number) => void }) {
  if (!data || data.total <= data.limit) return data ? <p className="muted small">{data.total} résultat(s)</p> : null;
  const pages = Math.ceil(data.total / data.limit);
  return (
    <div className="pager">
      <span className="muted small">{data.total} résultats · page {data.page}/{pages}</span>
      <button className="btn btn-ghost" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>← Précédent</button>
      <button className="btn btn-ghost" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}>Suivant →</button>
    </div>
  );
}

/** Barre de filtres : recherche + listes déroulantes. */
export function Filters({ params, set, search, selects = [] }: {
  params: Record<string, unknown>; set: (p: Record<string, unknown>) => void; search?: string;
  selects?: { key: string; label: string; options: [string, string][] }[];
}) {
  const [q, setQ] = useState(String(params.q ?? ''));
  const timer = useRef<ReturnType<typeof setTimeout>>();
  return (
    <div className="filters">
      {search && (
        <input
          type="search" placeholder={search} value={q} aria-label={search}
          onChange={(e) => {
            setQ(e.target.value);
            clearTimeout(timer.current);
            const v = e.target.value;
            timer.current = setTimeout(() => set({ q: v }), 350);
          }}
        />
      )}
      {selects.map((s) => (
        <select key={s.key} aria-label={s.label} value={String(params[s.key] ?? '')} onChange={(e) => set({ [s.key]: e.target.value })}>
          <option value="">{s.label} : tous</option>
          {s.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fenêtres & formulaires                                              */
/* ------------------------------------------------------------------ */

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export type FieldSpec = {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'select' | 'date' | 'email' | 'url' | 'checkbox' | 'tags' | 'image' | 'images' | 'multiselect';
  options?: [string, string][];
  required?: boolean;
  hint?: string;
  folder?: 'products' | 'companies' | 'advertisements' | 'categories' | 'site';
  full?: boolean;
};

const getPath = (o: any, path: string) => path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);
const setPath = (o: any, path: string, value: unknown) => {
  const keys = path.split('.');
  const copy = { ...o };
  let cur = copy;
  keys.slice(0, -1).forEach((k) => { cur[k] = { ...(cur[k] ?? {}) }; cur = cur[k]; });
  cur[keys[keys.length - 1]] = value;
  return copy;
};

/** Nettoie les valeurs vides avant envoi (les champs optionnels vides ne sont pas transmis). */
function clean(v: any): any {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const out: any = {};
    for (const [k, x] of Object.entries(v)) {
      const c = clean(x);
      if (c !== '' && c !== undefined && c !== null && !(typeof c === 'object' && !Array.isArray(c) && Object.keys(c).length === 0)) out[k] = c;
    }
    return out;
  }
  return v;
}

export function FormModal({ title, fields, initial, onSubmit, onClose, submitLabel = 'Enregistrer' }: {
  title: string; fields: FieldSpec[]; initial: Record<string, any>; onSubmit: (v: any) => Promise<void>;
  onClose: () => void; submitLabel?: string;
}) {
  const [values, setValues] = useState<Record<string, any>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (name: string, v: unknown) => setValues((s) => setPath(s, name, v));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(clean(values));
      toast('Enregistré');
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} wide={fields.length > 6}>
      <form onSubmit={submit} className="form-grid">
        {fields.map((f) => (
          <FieldInput key={f.name} spec={f} value={getPath(values, f.name)} onChange={(v) => set(f.name, v)} />
        ))}
        <div className="full"><ErrorBox error={error} /></div>
        <div className="full hstack gap end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}

function FieldInput({ spec, value, onChange }: { spec: FieldSpec; value: any; onChange: (v: any) => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const id = `f-${spec.name}`;
  const t = spec.type ?? 'text';
  const full = spec.full || ['textarea', 'images', 'multiselect', 'tags'].includes(t);

  const upload = async (files: FileList | null, multiple: boolean) => {
    if (!files?.length || !spec.folder) return;
    setUploading(true);
    setUploadError(null);
    try {
      const urls = await Promise.all(Array.from(files).map((f) => uploadImage(f, spec.folder!)));
      onChange(multiple ? [...(value ?? []), ...urls] : urls[0]);
    } catch (e: any) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  };

  let input: ReactNode;
  if (t === 'textarea') input = <textarea id={id} rows={4} value={value ?? ''} required={spec.required} onChange={(e) => onChange(e.target.value)} />;
  else if (t === 'select')
    input = (
      <select id={id} value={value ?? ''} required={spec.required} onChange={(e) => onChange(e.target.value)}>
        {/* Choix obligatoire : option vide non sélectionnable, le navigateur bloque l'envoi tant que rien n'est choisi. */}
        {spec.required ? <option value="" disabled>Choisir…</option> : <option value="">—</option>}
        {spec.options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    );
  else if (t === 'multiselect')
    input = (
      <div className="checks">
        {spec.options?.map(([v, l]) => (
          <label key={v} className="check">
            <input type="checkbox" checked={(value ?? []).includes(v)} onChange={(e) => onChange(e.target.checked ? [...(value ?? []), v] : (value ?? []).filter((x: string) => x !== v))} />
            {l}
          </label>
        ))}
      </div>
    );
  else if (t === 'checkbox') input = <label className="check"><input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> Oui</label>;
  else if (t === 'number') input = <input id={id} type="number" min={0} step={1} value={value ?? ''} required={spec.required} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />;
  else if (t === 'tags') input = <input id={id} value={(value ?? []).join(', ')} placeholder="Valeurs séparées par des virgules" onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />;
  else if (t === 'date') input = <input id={id} type="date" value={value ? String(value).slice(0, 10) : ''} required={spec.required} onChange={(e) => onChange(e.target.value)} />;
  else if (t === 'image' || t === 'images') {
    const list: string[] = t === 'image' ? (value ? [value] : []) : value ?? [];
    input = (
      <div>
        <div className="thumbs">
          {list.map((url) => (
            <div key={url} className="thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" />
              <button type="button" className="thumb-x" aria-label="Retirer" onClick={() => onChange(t === 'image' ? undefined : list.filter((u) => u !== url))}>✕</button>
            </div>
          ))}
        </div>
        <input id={id} type="file" accept="image/*" multiple={t === 'images'} disabled={uploading} onChange={(e) => upload(e.target.files, t === 'images')} />
        {uploading && <span className="muted small"> Envoi en cours…</span>}
        {uploadError && <div className="error small">{uploadError}</div>}
      </div>
    );
  } else input = <input id={id} type={t} value={value ?? ''} required={spec.required} onChange={(e) => onChange(e.target.value)} />;

  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <label htmlFor={id}>{spec.label}{spec.required && ' *'}</label>
      {input}
      {spec.hint && <small className="muted">{spec.hint}</small>}
    </div>
  );
}

/** Demande un motif puis exécute l'action (suspension, refus…). */
export function ReasonModal({ title, label = 'Motif', confirm, onConfirm, onClose, extra }: {
  title: string; label?: string; confirm: string; onConfirm: (reason: string) => Promise<void>; onClose: () => void; extra?: ReactNode;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onConfirm(reason);
            toast('Action effectuée');
            onClose();
          } catch (err: any) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {extra}
        <div className="field">
          <label htmlFor="reason">{label}</label>
          <textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} />
        </div>
        <ErrorBox error={error} />
        <div className="hstack gap end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={busy}>{confirm}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Choix d'une image unique (envoi Cloudinary) avec aperçu, remplacement et retrait. */
export function ImagePicker({ value, onChange, folder, label = 'Image', size = 72 }: {
  value?: string; onChange: (url: string) => void; folder: 'categories' | 'site' | 'products'; label?: string; size?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true); setErr(null);
    try { onChange(await uploadImage(f, folder)); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="img-pick">
      <div className="img-pick-box" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? <img src={value} alt="" /> : <span className="muted small">Aucune</span>}
      </div>
      <div>
        <label className="btn btn-sm" style={{ cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? 'Envoi…' : value ? `Remplacer ${label.toLowerCase()}` : `Choisir ${label.toLowerCase()}`}
          <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {value && <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange('')}>Retirer</button>}
        {err && <div className="error small">{err}</div>}
      </div>
    </div>
  );
}

/** Chargement des données : le logo Depanno qui tourne, à la place du texte « Chargement… ». */
export function Loading({ label = 'Chargement', minHeight = 200, compact }: { label?: string; minHeight?: number; compact?: boolean }) {
  return <LogoLoading logo="/brand/embleme-depanno.png" label={label} minHeight={compact ? 90 : minHeight} compact={compact} />;
}

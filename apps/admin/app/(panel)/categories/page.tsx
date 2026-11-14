'use client';

import { useState } from 'react';
import { api, uploadImage } from '@/lib/api';
import { TRADES } from '@/lib/format';
import { Badge, Card, ErrorBox, ImagePicker, Modal, PageHeader, useFetch, useToast } from '@/components/ui';
import { useCan } from '@/components/admin-context';

const toKey = (s: string, max = 50) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, max);

/** Petite vignette cliquable pour l'image d'un problème. */
function ProblemImage({ url, onChange }: { url?: string; onChange: (u: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="problem-img" title={url ? 'Remplacer l’image (clic droit : retirer)' : 'Ajouter une image'}
      onContextMenu={(e) => { if (url) { e.preventDefault(); onChange(''); } }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {busy ? '…' : url ? <img src={url} alt="" /> : '+ img'}
      <input type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f) return;
        setBusy(true);
        try { onChange(await uploadImage(f, 'categories')); } catch (err: any) { alert(err.message); } finally { setBusy(false); }
      }} />
    </label>
  );
}

function ProblemsEditor({ problems, onChange }: { problems: any[]; onChange: (p: any[]) => void }) {
  const [label, setLabel] = useState('');
  const add = () => {
    const key = toKey(label);
    if (key.length < 2 || problems.some((p) => p.key === key)) return;
    onChange([...problems, { key, label: label.trim(), active: true }]);
    setLabel('');
  };
  return (
    <>
      <label className="small" style={{ marginTop: 0 }}>Problèmes proposés aux clients <span className="muted">(cliquez sur la vignette pour mettre une image)</span></label>
      {problems.length === 0 && <p className="muted small">Aucun problème pour l’instant.</p>}
      {problems.map((p, i) => (
        <div key={p.key} className="hstack gap" style={{ margin: '6px 0' }}>
          <ProblemImage url={p.imageUrl} onChange={(u) => onChange(problems.map((x, j) => (j === i ? { ...x, imageUrl: u } : x)))} />
          <input style={{ flex: 1 }} value={p.label} aria-label="Libellé" onChange={(e) => onChange(problems.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <label className="check"><input type="checkbox" checked={p.active} onChange={(e) => onChange(problems.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x)))} /> Actif</label>
        </div>
      ))}
      <div className="hstack gap" style={{ marginTop: 8 }}>
        <input style={{ flex: 1 }} placeholder="Nouveau problème…" value={label} onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" className="btn" disabled={label.trim().length < 2} onClick={add}>Ajouter</button>
      </div>
    </>
  );
}

function CategoryEditor({ cat, onSaved }: { cat: any; onSaved: () => void }) {
  const toast = useToast();
  const can = useCan();
  const [c, setC] = useState({ ...cat, icon: cat.icon ?? '🔧', description: cat.description ?? '' });
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await api(`/service-categories/${c.trade}`, {
        method: 'PUT',
        body: {
          name: c.name, icon: c.icon || undefined, imageUrl: c.imageUrl ?? '', description: c.description || undefined, active: c.active, order: c.order,
          problems: c.problems.map((p: any) => ({ key: p.key, label: p.label, imageUrl: p.imageUrl ?? '', active: p.active })),
        },
      });
      toast('Service enregistré');
      onSaved();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Card title={c.imageUrl ? c.name : `${c.icon} ${c.name}`} actions={<Badge status={c.active ? 'active' : 'archived'}>{c.active ? 'Actif' : 'Désactivé'}</Badge>}>
      <div className="form-grid">
        <div className="field"><label>Nom affiché</label><input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></div>
        <div className="field"><label>Icône (émoji)</label><input value={c.icon} maxLength={8} onChange={(e) => setC({ ...c, icon: e.target.value })} /></div>
        <div className="field full"><label>Image du service (remplace l’icône sur le site)</label><ImagePicker value={c.imageUrl} folder="categories" onChange={(u) => setC({ ...c, imageUrl: u })} /></div>
        <div className="field full"><label>Description courte</label><input value={c.description} maxLength={200} onChange={(e) => setC({ ...c, description: e.target.value })} placeholder="Ex. : Moteur, freins, embrayage, entretien" /></div>
      </div>
      <ProblemsEditor problems={c.problems} onChange={(problems) => setC({ ...c, problems })} />
      <label className="check" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={c.active} onChange={(e) => setC({ ...c, active: e.target.checked })} /> Service proposé aux clients
      </label>
      <p className="muted small" style={{ margin: '.3rem 0 0' }}>Identifiant : <span className="mono">{c.trade}</span>. Un service n’est jamais supprimé (des professionnels et interventions y sont rattachés) : il peut être désactivé.</p>
      <ErrorBox error={error} />
      {can('catalog.write') && <div className="hstack end" style={{ marginTop: 10 }}><button className="btn btn-primary" onClick={save}>Enregistrer</button></div>}
    </Card>
  );
}

function NewService({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', trade: '', icon: '🔧', imageUrl: '', description: '', problems: [] as any[] });
  const [keyTouched, setKeyTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Nouveau service" onClose={onClose} wide>
      <form onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api('/service-categories', { method: 'POST', body: { ...f, imageUrl: f.imageUrl || undefined, description: f.description || undefined, active: true } });
          TRADES[f.trade] = f.name;
          toast(`Service « ${f.name} » créé`);
          onDone();
          onClose();
        } catch (err: any) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}>
        <div className="form-grid">
          <div className="field"><label htmlFor="n">Nom du service</label>
            <input id="n" required minLength={2} value={f.name} placeholder="Ex. : Climatisation auto"
              onChange={(e) => setF({ ...f, name: e.target.value, trade: keyTouched ? f.trade : toKey(e.target.value, 40) })} /></div>
          <div className="field"><label htmlFor="k">Identifiant (non modifiable ensuite)</label>
            <input id="k" required pattern="[a-z0-9_]{2,40}" value={f.trade} className="mono" onChange={(e) => { setKeyTouched(true); setF({ ...f, trade: toKey(e.target.value, 40) }); }} /></div>
          <div className="field"><label htmlFor="i">Icône (émoji)</label><input id="i" maxLength={8} value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} /></div>
          <div className="field full"><label>Image du service (facultatif)</label><ImagePicker value={f.imageUrl} folder="categories" onChange={(u) => setF({ ...f, imageUrl: u })} /></div>
          <div className="field"><label htmlFor="d">Description courte</label><input id="d" maxLength={200} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex. : Recharge, fuite, compresseur" /></div>
        </div>
        <ProblemsEditor problems={f.problems} onChange={(problems) => setF({ ...f, problems })} />
        <ErrorBox error={error} />
        <div className="hstack gap end" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Création…' : 'Créer le service'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function CategoriesPage() {
  const can = useCan();
  const { data, error, reload } = useFetch<any[]>('/service-categories');
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader title="Services & catégories" subtitle="Ajoutez une image à chaque service et à chaque problème : elle remplace l’icône sur le site client. Métiers proposés aux clients et problèmes qu’ils peuvent sélectionner. Vous pouvez créer de nouveaux services à tout moment."
        actions={can('catalog.write') && <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Nouveau service</button>} />
      <ErrorBox error={error} />
      <div className="grid grid-2">{data?.map((c) => <CategoryEditor key={c._id + (c.updatedAt ?? '')} cat={c} onSaved={reload} />)}</div>
      {creating && <NewService onClose={() => setCreating(false)} onDone={reload} />}
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, ErrorBox, ImagePicker, PageHeader, useFetch, useToast } from '@/components/ui';
import { useCan } from '@/components/admin-context';

/** Images du site client (bannières, tuiles Dépannage, en-têtes…) choisies par l'administration. */
export default function SiteImagesPage() {
  const can = useCan();
  const toast = useToast();
  const { data, error, reload } = useFetch<{ slots: { key: string; label: string; group: string }[]; values: Record<string, string> }>('/site-images');
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (data) setValues(data.values ?? {}); }, [data]);
  const groups = [...new Set(data?.slots.map((s) => s.group) ?? [])];
  const dirty = JSON.stringify(values) !== JSON.stringify(data?.values ?? {});

  const save = async () => {
    setBusy(true); setErr(null);
    try { await api('/site-images', { method: 'PUT', body: { values } }); toast('Visuels enregistrés'); reload(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Visuels du site" subtitle="Remplacez les images et icônes du site client par vos propres photos. Sans image choisie, le visuel par défaut (ou un emplacement réservé) reste affiché."
        actions={can('catalog.write') && <button className="btn btn-primary" disabled={!dirty || busy} onClick={save}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>} />
      <ErrorBox error={error ?? err} />
      {groups.map((g) => (
        <Card key={g} title={g}>
          <div className="site-img-grid">
            {data!.slots.filter((s) => s.group === g).map((s) => (
              <div key={s.key}>
                <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                {can('catalog.write')
                  ? <ImagePicker value={values[s.key]} folder="site" size={88} onChange={(u) => setValues((v) => { const n = { ...v }; if (u) n[s.key] = u; else delete n[s.key]; return n; })} />
                  : values[s.key] ? <img src={values[s.key]} alt="" style={{ width: 88, height: 88, objectFit: 'contain' }} /> : <span className="muted small">Visuel par défaut</span>}
              </div>
            ))}
          </div>
        </Card>
      ))}
      <p className="muted small">Les photos des produits se gèrent dans Produits, celles des services et problèmes dans Catégories, celles des catégories de produits dans Produits › Catégories.</p>
    </>
  );
}

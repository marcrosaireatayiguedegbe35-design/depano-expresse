'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { PageTitle } from '@/components/chrome';
import { Empty, ErrorBox, Loading, Modal, useFetch, useToast } from '@/components/ui';
import { Icon } from '@/components/icons';

export default function VehiclesPage() {
  const toast = useToast();
  const { data, reload } = useFetch<any[]>('/vehicles');
  const [edit, setEdit] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const body = { brand: edit.brand, model: edit.model, ...(edit.year ? { year: Number(edit.year) } : {}), ...(edit.plate ? { plate: edit.plate } : {}) };
    try {
      if (edit._id) await api(`/vehicles/${edit._id}`, { method: 'PATCH', body });
      else await api('/vehicles', { method: 'POST', body });
      setEdit(null);
      reload();
      toast('Véhicule enregistré');
    } catch (err: any) { setError(err.message); }
  };
  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <PageTitle title="Mes véhicules" back="/compte">
        <button className="icon-btn" style={{ background: 'var(--orange)', color: '#fff' }} onClick={() => setEdit({ brand: '', model: '', year: '', plate: '' })} aria-label="Ajouter un véhicule"><Icon name="plus" /></button>
      </PageTitle>
      {!data ? <Loading /> : data.length === 0 ? <Empty icon="🚗" title="Aucun véhicule">Ajoutez vos véhicules pour remplir plus vite vos demandes.</Empty> : data.map((v) => (
        <div key={v._id} className="list-row">
          <span className="list-thumb" style={{ width: 56, height: 56 }}>🚗</span>
          <div className="grow"><h3>{v.brand} {v.model}</h3><p className="small muted">{[v.year, v.plate].filter(Boolean).join(' · ') || '—'}</p></div>
          <button className="btn btn-xs" onClick={() => setEdit({ ...v, year: v.year ?? '' })}>Modifier</button>
          <button className="back" style={{ width: 30, height: 30 }} aria-label="Supprimer" onClick={async () => { if (confirm('Supprimer ce véhicule ?')) { await api(`/vehicles/${v._id}`, { method: 'DELETE' }); reload(); } }}><Icon name="trash" /></button>
        </div>
      ))}
      {edit && (
        <Modal title={edit._id ? 'Modifier le véhicule' : 'Ajouter un véhicule'} onClose={() => setEdit(null)}>
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field"><label htmlFor="vb">Marque</label><input id="vb" required value={edit.brand} onChange={(e) => setEdit({ ...edit, brand: e.target.value })} placeholder="Toyota" /></div>
              <div className="field"><label htmlFor="vm">Modèle</label><input id="vm" required value={edit.model} onChange={(e) => setEdit({ ...edit, model: e.target.value })} placeholder="Corolla" /></div>
              <div className="field"><label htmlFor="vy">Année</label><input id="vy" type="number" min={1950} max={2100} value={edit.year} onChange={(e) => setEdit({ ...edit, year: e.target.value })} /></div>
              <div className="field"><label htmlFor="vp">Immatriculation</label><input id="vp" value={edit.plate ?? ''} onChange={(e) => setEdit({ ...edit, plate: e.target.value })} /></div>
            </div>
            <ErrorBox error={error} />
            <button className="btn btn-primary btn-block">Enregistrer</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

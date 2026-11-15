'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { dateTime, fcfa } from '@/lib/format';
import { useMe } from '@/components/admin-context';
import { Card, ErrorBox, PageHeader, Table, useFetch, useToast, Loading } from '@/components/ui';

const MODES: Record<string, string> = {
  services_only: 'Prestations uniquement (main-d’œuvre, diagnostic, déplacement, autres prestations) — pièces et dépenses externes exclues',
  full_invoice: 'Totalité de la facture, pièces comprises',
};

export default function SettingsPage() {
  const me = useMe();
  const toast = useToast();
  const { data, error, reload } = useFetch<any>('/settings/commission');
  const [form, setForm] = useState<{ ratePercent: string; baseMode: string; reason: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isSuper = me.role === 'super_admin';

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading minHeight={320} />;
  const f = form ?? { ratePercent: String(data.ratePercent), baseMode: data.baseMode, reason: '' };
  const rate = Number(f.ratePercent) || 0;
  // Exemple du CDC : 50 000 FCFA de prestations
  const example = Math.round(50000 * rate / 100);

  return (
    <>
      <PageHeader title="Taux de commission" subtitle="Le nouveau taux s’applique aux factures validées après le changement — jamais rétroactivement." />
      <div className="grid grid-2">
        <Card title="Paramètres en vigueur">
          <p style={{ fontSize: 32, fontWeight: 700, margin: '4px 0' }}>{data.ratePercent} %</p>
          <p className="small">{MODES[data.baseMode]}</p>
          <div className="alert alert-info small">
            Exemple : prestation de 50 000 FCFA → plateforme {fcfa(Math.round(50000 * data.ratePercent / 100))}, professionnel {fcfa(50000 - Math.round(50000 * data.ratePercent / 100))}.
            Le client paie toujours exactement le montant qu’il a confirmé.
          </div>
        </Card>
        <Card title="Modifier">
          {!isSuper ? (
            <div className="alert alert-warning">Modification réservée au super administrateur. Toute modification est inscrite au journal d’audit.</div>
          ) : (
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSaveError(null);
              try {
                await api('/settings/commission', { method: 'PUT', body: { ratePercent: rate, baseMode: f.baseMode, reason: f.reason } });
                toast('Taux mis à jour');
                setForm(null);
                reload();
              } catch (err: any) { setSaveError(err.message); }
            }}>
              <div className="field">
                <label htmlFor="rate">Taux (%)</label>
                <input id="rate" type="number" min={0} max={50} step={0.01} required value={f.ratePercent} onChange={(e) => setForm({ ...f, ratePercent: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="mode">Base de calcul</label>
                <select id="mode" value={f.baseMode} onChange={(e) => setForm({ ...f, baseMode: e.target.value })}>
                  {Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="reason">Justification (obligatoire)</label>
                <textarea id="reason" rows={2} required minLength={5} value={f.reason} onChange={(e) => setForm({ ...f, reason: e.target.value })} />
              </div>
              <p className="small muted">Aperçu : 50 000 FCFA de prestations → commission {fcfa(example)}, net professionnel {fcfa(50000 - example)}.</p>
              <ErrorBox error={saveError} />
              <button className="btn btn-primary">Appliquer le nouveau taux</button>
            </form>
          )}
        </Card>
      </div>
      <Card title="Historique des taux">
        <Table rows={data.history} columns={[
          { key: 'effectiveFrom', label: 'Depuis le', render: (h: any) => dateTime(h.effectiveFrom) },
          { key: 'rateBps', label: 'Taux', render: (h: any) => `${h.rateBps / 100} %` },
          { key: 'baseMode', label: 'Base', render: (h: any) => (h.baseMode === 'services_only' ? 'Prestations' : 'Facture entière') },
          { key: 'setByEmail', label: 'Par', render: (h: any) => h.setByEmail ?? 'Initialisation' },
          { key: 'reason', label: 'Justification' },
        ]} />
      </Card>
    </>
  );
}

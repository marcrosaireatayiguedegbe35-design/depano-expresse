'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useMe } from '@/components/admin-context';
import { Card, ErrorBox, ImagePicker, Loading, PageHeader, useFetch, useToast } from '@/components/ui';

const FIELDS: [string, string, string][] = [
  ['name', 'Raison sociale', 'Ex. : Depanno Expresse'],
  ['legalForm', 'Forme juridique', 'Ex. : SARL au capital de 1 000 000 FCFA'],
  ['rccm', 'Numéro RCCM', 'Ex. : RB/COT/24 B 12345'],
  ['ifu', 'Numéro IFU', '13 chiffres'],
  ['address', 'Adresse du siège', 'Quartier, rue, ville'],
  ['city', 'Ville de signature', 'Ex. : Cotonou'],
  ['representative', 'Représentant légal', 'Prénom et nom'],
  ['representativeTitle', 'Qualité du représentant', 'Ex. : Gérant, Directeur général'],
  ['phone', 'Téléphone', '+229 …'],
  ['email', 'E-mail', 'contact@…'],
];

/** Identité légale de la plateforme reprise dans le contrat signé par chaque professionnel. */
export default function ContractSettingsPage() {
  const me = useMe();
  const toast = useToast();
  const { data, error, reload } = useFetch<any>('/professionals/contract-settings');
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isSuper = me.role === 'super_admin';
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading minHeight={320} />;
  const f: Record<string, string> = form ?? Object.fromEntries([...FIELDS.map(([k]) => [k, data.company[k] ?? '']), ['stampUrl', data.company.stampUrl ?? '']]);
  const missing = ['rccm', 'ifu', 'representative'].filter((k) => !data.company[k]);

  return (
    <>
      <PageHeader title="Contrat des professionnels" subtitle="Ces informations figurent en tête du contrat que chaque professionnel signe au doigt après son inscription." />
      {missing.length > 0 && <div className="alert alert-warning">À compléter pour un contrat officiel : {missing.map((k) => FIELDS.find((x) => x[0] === k)![1]).join(', ')}. En attendant, ces champs apparaissent en pointillés dans les contrats.</div>}
      <div className="grid grid-2">
        <Card title="Identité légale de la plateforme">
          <form onSubmit={async (e) => {
            e.preventDefault();
            setSaveError(null);
            try {
              const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]).filter(([k, v]) => v || k === 'name'));
              await api('/professionals/contract-settings', { method: 'PUT', body });
              toast('Informations du contrat enregistrées');
              setForm(null);
              reload();
            } catch (err: any) { setSaveError(err.message); }
          }}>
            {FIELDS.map(([k, label, ph]) => (
              <div className="field" key={k}>
                <label htmlFor={k}>{label}</label>
                <input id={k} disabled={!isSuper} required={k === 'name'} placeholder={ph} value={f[k]} onChange={(e) => setForm({ ...f, [k]: e.target.value })} />
              </div>
            ))}
            <div className="field">
              <label>Cachet et signature de la plateforme (image, facultatif)</label>
              {isSuper ? <ImagePicker folder="site" label="Le cachet" size={96} value={f.stampUrl} onChange={(url) => setForm({ ...f, stampUrl: url })} />
                : f.stampUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.stampUrl} alt="Cachet" style={{ maxHeight: 96 }} /> : <p className="muted small">Aucun cachet</p>}
              <p className="small muted">Apparaît dans le cadre « Pour la Plateforme » de chaque PDF. Image sur fond blanc ou transparent.</p>
            </div>
            <ErrorBox error={saveError} />
            {isSuper ? <button className="btn btn-primary">Enregistrer</button> : <div className="alert alert-info small">Modification réservée au super administrateur.</div>}
          </form>
        </Card>
        <Card title="Comment ça marche">
          <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.6 }}>
            <li>Après la vérification de son e-mail, le professionnel indique sa pièce d’identité, lit son contrat personnalisé (nom, pièce, métier, atelier, localisation, taux de commission) puis le signe avec le doigt.</li>
            <li>Le texte signé est figé et protégé par une empreinte SHA-256 ; la date, l’heure, l’adresse IP et l’appareil sont conservés.</li>
            <li>Le professionnel et l’administration peuvent télécharger le PDF officiel (contrat + certificat de signature) depuis la fiche du professionnel.</li>
            <li>Les changements faits ici s’appliquent aux prochains contrats ; ceux déjà signés restent inchangés.</li>
            <li>Un compte ne peut être validé que si le contrat est signé et toutes les pièces obligatoires acceptées.</li>
          </ul>
          <div className="alert alert-warning small">Faites relire le texte du contrat par un juriste avant une utilisation à grande échelle.</div>
        </Card>
      </div>
    </>
  );
}

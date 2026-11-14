'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { date } from '@/lib/format';
import { useCan } from '@/components/admin-context';
import { Badge, Card, ErrorBox, FieldSpec, Filters, FormModal, PageHeader, Pager, Table, useList } from '@/components/ui';

const FIELDS: FieldSpec[] = [
  { name: 'name', label: 'Nom', required: true },
  { name: 'activity', label: 'Activité' },
  { name: 'status', label: 'Statut', type: 'select', required: true, options: [['pending', 'En attente'], ['validated', 'Validée'], ['rejected', 'Refusée']] },
  { name: 'address', label: 'Adresse' },
  { name: 'phone', label: 'Téléphone' },
  { name: 'whatsapp', label: 'WhatsApp' },
  { name: 'email', label: 'E-mail', type: 'email' },
  { name: 'hours', label: 'Horaires' },
  { name: 'website', label: 'Site officiel (https://…)', type: 'url', hint: 'Affiche le bouton « Visiter le site officiel »' },
  { name: 'socials.facebook', label: 'Facebook', type: 'url' },
  { name: 'socials.instagram', label: 'Instagram', type: 'url' },
  { name: 'socials.linkedin', label: 'LinkedIn', type: 'url' },
  { name: 'socials.tiktok', label: 'TikTok', type: 'url' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'logoUrl', label: 'Logo', type: 'image', folder: 'companies' },
  { name: 'bannerUrl', label: 'Bannière', type: 'image', folder: 'companies' },
  { name: 'gallery', label: 'Galerie', type: 'images', folder: 'companies' },
];

export default function CompaniesPage() {
  const can = useCan();
  const { data, error, params, set, setPage, reload } = useList('/companies');
  const [editing, setEditing] = useState<any>(null);
  const save = async (v: any) => {
    const { _id, createdAt, updatedAt, __v, ...body } = v;
    if (editing._id) await api(`/companies/${editing._id}`, { method: 'PATCH', body });
    else await api('/companies', { method: 'POST', body });
    reload();
  };
  return (
    <>
      <PageHeader title="Annuaire des entreprises" subtitle="Création, validation et modification des fiches entreprises."
        actions={can('companies.write') && <button className="btn btn-primary" onClick={() => setEditing({ status: 'pending' })}>Nouvelle entreprise</button>} />
      <Filters params={params} set={set} search="Nom, activité, adresse…" selects={[{ key: 'status', label: 'Statut', options: [['pending', 'En attente'], ['validated', 'Validée'], ['rejected', 'Refusée']] }]} />
      <ErrorBox error={error} />
      <Card>
        <Table rows={data?.items} onRowClick={can('companies.write') ? setEditing : undefined} columns={[
          // eslint-disable-next-line @next/next/no-img-element
          { key: 'logo', label: '', render: (c: any) => (c.logoUrl ? <img src={c.logoUrl} alt="" width={36} height={36} style={{ borderRadius: 6, objectFit: 'cover' }} /> : null) },
          { key: 'name', label: 'Entreprise', render: (c: any) => <><strong>{c.name}</strong><div className="muted small">{c.activity}</div></> },
          { key: 'address', label: 'Adresse' },
          { key: 'phone', label: 'Téléphone' },
          { key: 'website', label: 'Site officiel', render: (c: any) => (c.website ? <a href={c.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Visiter</a> : '—') },
          { key: 'status', label: 'Statut', render: (c: any) => <Badge status={c.status} /> },
          { key: 'createdAt', label: 'Créée le', render: (c: any) => date(c.createdAt) },
        ]} />
        <Pager data={data} onPage={setPage} />
      </Card>
      {editing && <FormModal title={editing._id ? 'Modifier la fiche' : 'Nouvelle entreprise'} fields={FIELDS} initial={editing} onSubmit={save} onClose={() => setEditing(null)} />}
    </>
  );
}

'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { date, fcfa, num } from '@/lib/format';
import { useCan } from '@/components/admin-context';
import { Badge, Card, ErrorBox, FieldSpec, Filters, FormModal, PageHeader, Pager, Table, useFetch, useList, useToast } from '@/components/ui';

const KINDS: [string, string][] = [['ad', 'Publicité'], ['promotion', 'Promotion'], ['announcement', 'Annonce'], ['news', 'Actualité'], ['event', 'Événement'], ['partner', 'Partenaire'], ['campaign', 'Campagne de marque']];
const PLACEMENTS: [string, string][] = [['home', 'Accueil'], ['marketplace', 'Marketplace'], ['directory', 'Annuaire'], ['news', 'Actualités'], ['mobile', 'Application mobile']];
const STATUSES: [string, string][] = [['draft', 'Brouillon'], ['active', 'Active'], ['paused', 'En pause'], ['ended', 'Terminée']];

export default function AdsPage() {
  const can = useCan();
  const toast = useToast();
  const companies = useFetch<any>(can('companies.read') ? '/companies?status=validated&limit=100' : null);
  const { data, error, params, set, setPage, reload } = useList('/advertisements');
  const [editing, setEditing] = useState<any>(null);

  const fields: FieldSpec[] = [
    { name: 'title', label: 'Titre', required: true },
    { name: 'kind', label: 'Type', type: 'select', options: KINDS, required: true },
    { name: 'companyId', label: 'Entreprise', type: 'select', options: (companies.data?.items ?? []).map((c: any) => [c._id, c.name]) },
    { name: 'status', label: 'Statut', type: 'select', options: STATUSES, required: true },
    { name: 'startAt', label: 'Début', type: 'date', required: true },
    { name: 'endAt', label: 'Fin', type: 'date', required: true },
    { name: 'link', label: 'Lien', type: 'url' },
    { name: 'website', label: 'Site officiel', type: 'url' },
    { name: 'sponsoredLabel', label: 'Mention visible', required: true, hint: 'Les publicités doivent rester identifiables (ex. « Publicité », « Sponsorisé »)' },
    { name: 'campaign.name', label: 'Nom de campagne' },
    { name: 'campaign.price', label: 'Prix facturé (FCFA)', type: 'number' },
    { name: 'campaign.budget', label: 'Budget (FCFA)', type: 'number' },
    { name: 'placements', label: 'Emplacements', type: 'multiselect', options: PLACEMENTS },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'imageUrl', label: 'Visuel', type: 'image', folder: 'advertisements', full: true },
  ];

  const save = async (v: any) => {
    const { _id, createdAt, updatedAt, __v, stats, ...body } = v;
    body.companyId = typeof body.companyId === 'object' ? body.companyId?._id : body.companyId;
    body.placements = body.placements ?? [];
    if (editing._id) await api(`/advertisements/${editing._id}`, { method: 'PATCH', body });
    else await api('/advertisements', { method: 'POST', body });
    reload();
  };

  const remove = async (a: any) => {
    if (!confirm(`Supprimer « ${a.title} » ?`)) return;
    await api(`/advertisements/${a._id}`, { method: 'DELETE' });
    toast('Publication supprimée');
    reload();
  };

  return (
    <>
      <PageHeader title="Publicités & actualités" subtitle="Campagnes d’entreprises, promotions, annonces et actualités automobiles."
        actions={can('ads.write') && <button className="btn btn-primary" onClick={() => setEditing({ kind: 'ad', status: 'draft', sponsoredLabel: 'Publicité', placements: ['home'] })}>Nouvelle publication</button>} />
      <Filters params={params} set={set} search="Titre, campagne…" selects={[
        { key: 'status', label: 'Statut', options: STATUSES },
        { key: 'placement', label: 'Emplacement', options: PLACEMENTS },
      ]} />
      <ErrorBox error={error} />
      <Card>
        <Table rows={data?.items}
          onRowClick={can('ads.write') ? (a: any) => setEditing({ ...a, companyId: a.companyId?._id, startAt: a.startAt?.slice(0, 10), endAt: a.endAt?.slice(0, 10) }) : undefined}
          columns={[
            { key: 'title', label: 'Publication', render: (a: any) => <><strong>{a.title}</strong><div className="muted small">{KINDS.find((k) => k[0] === a.kind)?.[1]} · {a.companyId?.name ?? 'Plateforme'}</div></> },
            { key: 'placements', label: 'Emplacements', render: (a: any) => a.placements.map((p: string) => PLACEMENTS.find((x) => x[0] === p)?.[1]).join(', ') },
            { key: 'period', label: 'Période', render: (a: any) => `${date(a.startAt)} → ${date(a.endAt)}` },
            { key: 'impressions', label: 'Impressions', align: 'right', render: (a: any) => num(a.stats?.impressions) },
            { key: 'clicks', label: 'Clics', align: 'right', render: (a: any) => num(a.stats?.clicks) },
            { key: 'ctr', label: 'CTR', align: 'right', render: (a: any) => (a.stats?.impressions ? `${((a.stats.clicks / a.stats.impressions) * 100).toFixed(2)} %` : '—') },
            { key: 'price', label: 'Revenu', align: 'right', render: (a: any) => fcfa(a.campaign?.price) },
            { key: 'status', label: 'Statut', render: (a: any) => <Badge status={a.status} /> },
            { key: 'x', label: '', render: (a: any) => can('ads.write') && <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); remove(a); }}>Supprimer</button> },
          ]} />
        <Pager data={data} onPage={setPage} />
      </Card>
      {editing && <FormModal title={editing._id ? 'Modifier la publication' : 'Nouvelle publication'} fields={fields} initial={editing} onSubmit={save} onClose={() => setEditing(null)} />}
    </>
  );
}

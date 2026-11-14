'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { fcfa } from '@/lib/format';
import { useCan } from '@/components/admin-context';
import { Badge, Card, ErrorBox, FieldSpec, Filters, FormModal, PageHeader, Pager, Table, Tabs, useFetch, useList, useToast } from '@/components/ui';

function Products() {
  const can = useCan();
  const toast = useToast();
  const cats = useFetch<any[]>('/product-categories');
  const { data, error, params, set, setPage, reload } = useList('/products');
  const [editing, setEditing] = useState<any>(null);
  const catOptions: [string, string][] = (cats.data ?? []).map((c) => [c._id, c.name]);

  const fields: FieldSpec[] = [
    { name: 'name', label: 'Nom', required: true },
    { name: 'reference', label: 'Référence', required: true },
    { name: 'categoryId', label: 'Catégorie', type: 'select', options: catOptions, required: true },
    { name: 'brand', label: 'Marque' },
    { name: 'price', label: 'Prix (FCFA)', type: 'number', required: true },
    { name: 'promoPrice', label: 'Prix promotionnel (FCFA)', type: 'number' },
    { name: 'stock', label: 'Stock', type: 'number', required: true },
    { name: 'warranty', label: 'Garantie' },
    { name: 'status', label: 'Statut', type: 'select', required: true, options: [['draft', 'Brouillon'], ['published', 'Publié'], ['archived', 'Archivé']] },
    { name: 'compatibility', label: 'Compatibilité (véhicules)', type: 'tags' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'images', label: 'Images', type: 'images', folder: 'products' },
  ];

  const save = async (v: any) => {
    const body = { ...v, categoryId: typeof v.categoryId === 'object' ? v.categoryId._id : v.categoryId };
    delete body._id; delete body.createdAt; delete body.updatedAt; delete body.__v;
    if (body.specs) body.specs = body.specs.map((s: any) => ({ name: s.name, value: s.value }));
    if (editing._id) await api(`/products/${editing._id}`, { method: 'PATCH', body });
    else await api('/products', { method: 'POST', body });
    reload();
  };

  const remove = async (p: any) => {
    if (!confirm(`Supprimer définitivement « ${p.name} » ?`)) return;
    try {
      await api(`/products/${p._id}`, { method: 'DELETE' });
      toast('Produit supprimé');
      reload();
    } catch (e: any) { toast(e.message, 'danger'); }
  };

  return (
    <>
      <div className="hstack between">
        <Filters params={params} set={set} search="Nom, référence, marque…" selects={[
          { key: 'status', label: 'Statut', options: [['draft', 'Brouillon'], ['published', 'Publié'], ['archived', 'Archivé']] },
          { key: 'categoryId', label: 'Catégorie', options: catOptions },
          { key: 'lowStock', label: 'Stock', options: [['true', 'Stock faible (≤ 5)']] },
        ]} />
        {can('products.write') && <button className="btn btn-primary" onClick={() => setEditing({ status: 'draft', stock: 0, images: [] })}>Nouveau produit</button>}
      </div>
      <ErrorBox error={error} />
      <Table rows={data?.items} onRowClick={can('products.write') ? (p: any) => setEditing({ ...p, categoryId: p.categoryId?._id ?? p.categoryId }) : undefined} columns={[
        { key: 'name', label: 'Produit', render: (p: any) => <><strong>{p.name}</strong><div className="muted small mono">{p.reference}</div></> },
        { key: 'cat', label: 'Catégorie', render: (p: any) => p.categoryId?.name },
        { key: 'brand', label: 'Marque' },
        { key: 'price', label: 'Prix', align: 'right', render: (p: any) => p.promoPrice ? <><s className="muted">{fcfa(p.price)}</s><div>{fcfa(p.promoPrice)}</div></> : fcfa(p.price) },
        { key: 'stock', label: 'Stock', align: 'right', render: (p: any) => <span className={p.stock <= 5 ? 'error' : ''}>{p.stock}</span> },
        { key: 'status', label: 'Statut', render: (p: any) => <Badge status={p.status} /> },
        { key: 'a', label: '', render: (p: any) => can('products.write') && <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); remove(p); }}>Supprimer</button> },
      ]} />
      <Pager data={data} onPage={setPage} />
      {editing && <FormModal title={editing._id ? 'Modifier le produit' : 'Nouveau produit'} fields={fields} initial={editing} onSubmit={save} onClose={() => setEditing(null)} />}
    </>
  );
}

function Categories() {
  const can = useCan();
  const { data, error, reload } = useFetch<any[]>('/product-categories');
  const [editing, setEditing] = useState<any>(null);
  return (
    <>
      {can('products.write') && <div className="hstack end" style={{ marginBottom: 10 }}><button className="btn btn-primary" onClick={() => setEditing({ active: true })}>Nouvelle catégorie</button></div>}
      <ErrorBox error={error} />
      <Table rows={data ?? undefined} onRowClick={can('products.write') ? setEditing : undefined} columns={[
        { key: 'img', label: 'Image', render: (c: any) => (c.imageUrl ? <img src={c.imageUrl} alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8 }} /> : <span className="muted small">—</span>) },
        { key: 'name', label: 'Nom' }, { key: 'slug', label: 'Slug', render: (c: any) => <span className="mono">{c.slug}</span> },
        { key: 'active', label: 'Statut', render: (c: any) => <Badge status={c.active ? 'active' : 'archived'}>{c.active ? 'Active' : 'Inactive'}</Badge> },
      ]} />
      {editing && (
        <FormModal title={editing._id ? 'Modifier la catégorie' : 'Nouvelle catégorie'} initial={editing} onClose={() => setEditing(null)}
          fields={[{ name: 'name', label: 'Nom', required: true }, { name: 'slug', label: 'Slug (a-z, 0-9, -)', required: true }, { name: 'imageUrl', label: 'Image (remplace l’icône sur le site)', type: 'image', folder: 'categories' }, { name: 'active', label: 'Active', type: 'checkbox' }]}
          onSubmit={async (v) => {
            const body = { name: v.name, slug: v.slug, imageUrl: v.imageUrl ?? '', active: !!v.active };
            if (editing._id) await api(`/product-categories/${editing._id}`, { method: 'PATCH', body });
            else await api('/product-categories', { method: 'POST', body });
            reload();
          }} />
      )}
    </>
  );
}

export default function ProductsPage() {
  const [tab, setTab] = useState<'products' | 'categories'>('products');
  return (
    <>
      <PageHeader title="Marketplace – Produits" subtitle="Produits exclusivement automobiles, publiés uniquement par l’administration." />
      <Tabs tabs={[['products', 'Produits'], ['categories', 'Catégories']]} value={tab} onChange={setTab} />
      <Card>{tab === 'products' ? <Products /> : <Categories />}</Card>
    </>
  );
}

'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useCan, useMe } from '@/components/admin-context';
import { Badge, Card, ErrorBox, FormModal, Modal, PageHeader, Pager, Table, useFetch, useList, useToast } from '@/components/ui';

function SecretModal({ title, password, onClose }: { title: string; password: string; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="alert alert-warning">Ce mot de passe temporaire n’est affiché qu’une seule fois. Transmettez-le par un canal sûr : l’administrateur devra le changer et configurer la 2FA à sa première connexion.</div>
      <p className="mono" style={{ fontSize: 18, textAlign: 'center', userSelect: 'all' }}>{password}</p>
      <div className="hstack end"><button className="btn btn-primary" onClick={onClose}>J’ai noté le mot de passe</button></div>
    </Modal>
  );
}

export default function AdminsPage() {
  const me = useMe();
  const can = useCan();
  const toast = useToast();
  const roles = useFetch<any>('/admins/roles');
  const { data, error, setPage, reload } = useList('/admins');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [secret, setSecret] = useState<{ title: string; password: string } | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);
  const roleOptions: [string, string][] = (roles.data?.roles ?? [])
    .filter((r: any) => me.role === 'super_admin' || r.key !== 'super_admin')
    .map((r: any) => [r.key, r.label]);
  const roleLabel = (k: string) => roles.data?.roles.find((r: any) => r.key === k)?.label ?? k;

  const action = async (a: any, path: string, msg: string, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    try {
      const r = await api(`/admins/${a._id}/${path}`, { method: 'POST' });
      if (r.temporaryPassword) setSecret({ title: `Nouveau mot de passe – ${a.email}`, password: r.temporaryPassword });
      else toast(msg);
      reload();
    } catch (e: any) { toast(e.message, 'danger'); }
  };

  return (
    <>
      <PageHeader title="Administrateurs" subtitle="Comptes du back-office, rôles et accès. Double authentification obligatoire pour tous."
        actions={<>
          <button className="btn" onClick={() => setShowMatrix(true)}>Matrice des permissions</button>
          {can('admins.write') && <button className="btn btn-primary" onClick={() => setCreating(true)}>Nouvel administrateur</button>}
        </>} />
      <ErrorBox error={error} />
      <Card>
        <Table rows={data?.items} columns={[
          { key: 'name', label: 'Nom', render: (a: any) => <><strong>{a.name}</strong>{a._id === me.id && <span className="muted small"> (vous)</span>}<div className="muted small">{a.email}</div></> },
          { key: 'role', label: 'Rôle', render: (a: any) => roleLabel(a.role) },
          { key: 'status', label: 'Statut', render: (a: any) => <Badge status={a.status} /> },
          { key: '2fa', label: '2FA', render: (a: any) => (a.totpEnabled ? <Badge status="validated">Active</Badge> : <Badge status="pending">À configurer</Badge>) },
          { key: 'lock', label: 'Verrouillage', render: (a: any) => (a.lockedUntil && new Date(a.lockedUntil) > new Date() ? <Badge status="contested">Jusqu’à {dateTime(a.lockedUntil)}</Badge> : '—') },
          { key: 'lastLoginAt', label: 'Dernière connexion', render: (a: any) => <>{dateTime(a.lastLoginAt)}<div className="mono">{a.lastLoginIp}</div></> },
          {
            key: 'actions', label: '', render: (a: any) => can('admins.write') && a._id !== me.id && (me.role === 'super_admin' || a.role !== 'super_admin') && (
              <div className="hstack gap">
                <button className="btn btn-sm" onClick={() => setEditing(a)}>Modifier</button>
                <button className="btn btn-sm" onClick={() => action(a, 'reset-password', '', `Réinitialiser le mot de passe de ${a.email} ?`)}>Mot de passe</button>
                <button className="btn btn-sm" onClick={() => action(a, 'reset-2fa', '2FA réinitialisée', `Réinitialiser la 2FA de ${a.email} ? Il devra la reconfigurer.`)}>2FA</button>
                <button className="btn btn-sm" onClick={() => action(a, 'revoke-sessions', 'Sessions révoquées')}>Déconnecter</button>
              </div>
            ),
          },
        ]} />
        <Pager data={data} onPage={setPage} />
      </Card>

      {creating && (
        <FormModal title="Nouvel administrateur" submitLabel="Créer" initial={{ role: roleOptions[1]?.[0] ?? roleOptions[0]?.[0] }} onClose={() => setCreating(false)}
          fields={[{ name: 'name', label: 'Nom complet', required: true }, { name: 'email', label: 'E-mail', type: 'email', required: true }, { name: 'role', label: 'Rôle', type: 'select', options: roleOptions, required: true }]}
          onSubmit={async (v) => {
            const r = await api('/admins', { method: 'POST', body: v });
            setSecret({ title: `Compte créé – ${r.email}`, password: r.temporaryPassword });
            reload();
          }} />
      )}
      {editing && (
        <FormModal title={`Modifier ${editing.email}`} initial={{ name: editing.name, role: editing.role, status: editing.status }} onClose={() => setEditing(null)}
          fields={[
            { name: 'name', label: 'Nom', required: true },
            { name: 'role', label: 'Rôle', type: 'select', options: roleOptions, required: true },
            { name: 'status', label: 'Statut', type: 'select', options: [['active', 'Actif'], ['suspended', 'Suspendu (révoque ses sessions)']], required: true },
          ]}
          onSubmit={async (v) => { await api(`/admins/${editing._id}`, { method: 'PATCH', body: v }); reload(); }} />
      )}
      {secret && <SecretModal {...secret} onClose={() => setSecret(null)} />}
      {showMatrix && roles.data && (
        <Modal title="Matrice des permissions" onClose={() => setShowMatrix(false)} wide>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Permission</th>{roles.data.roles.map((r: any) => <th key={r.key} className="small">{r.label}</th>)}</tr></thead>
              <tbody>
                {roles.data.permissions.map((p: any) => (
                  <tr key={p.key}>
                    <td className="small">{p.label}</td>
                    {roles.data.roles.map((r: any) => <td key={r.key} className="center">{r.permissions.includes(p.key) ? '✓' : ''}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </>
  );
}

'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useCan, useMe } from '@/components/admin-context';
import { Badge, Card, ErrorBox, FormModal, Modal, PageHeader, Pager, useFetch, useList, useToast } from '@/components/ui';

function SecretModal({ title, password, onClose }: { title: string; password: string; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="alert alert-warning">Ce mot de passe temporaire n’est affiché qu’une seule fois. Transmettez-le par un canal sûr : l’administrateur devra le changer et configurer la 2FA à sa première connexion.</div>
      <p className="mono" style={{ fontSize: 18, textAlign: 'center', userSelect: 'all' }}>{password}</p>
      <div className="hstack end"><button className="btn btn-primary" onClick={onClose}>J’ai noté le mot de passe</button></div>
    </Modal>
  );
}

type MenuItem = [string, () => void, boolean?];
const initials = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

/** Menu « Gérer » : regroupe les actions sur un compte au lieu d'une pile de boutons. */
function ActionsMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="adm-menu">
      <button className="btn btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>Gérer ▾</button>
      {open && (
        <>
          <div className="adm-menu-bg" onClick={() => setOpen(false)} />
          <div className="adm-menu-list" role="menu">
            {items.map(([label, fn, danger]) => (
              <button key={label} role="menuitem" className={danger ? 'danger' : ''} onClick={() => { setOpen(false); fn(); }}>{label}</button>
            ))}
          </div>
        </>
      )}
    </div>
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

  const remove = async (a: any) => {
    if (!confirm(`Supprimer définitivement le compte administrateur ${a.name} (${a.email}) ?\n\nIl sera déconnecté immédiatement et ne pourra plus accéder au back-office. Cette action est irréversible.`)) return;
    try {
      await api(`/admins/${a._id}`, { method: 'DELETE' });
      toast(`Compte ${a.email} supprimé`);
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
        <div className="adm-list">
          {!data ? <p className="muted center" style={{ padding: 24 }}>Chargement…</p> : data.items.length === 0 ? <p className="muted center" style={{ padding: 24 }}>Aucun administrateur</p> : data.items.map((a: any) => {
            const isMe = a._id === me.id;
            const locked = a.lockedUntil && new Date(a.lockedUntil) > new Date();
            const manageable = can('admins.write') && !isMe && !a.isOwner && (me.role === 'super_admin' || a.role !== 'super_admin');
            return (
              <div key={a._id} className="adm-row">
                <span className={`adm-avatar${a.role === 'super_admin' ? ' super' : ''}`}>{initials(a.name)}</span>
                <div className="adm-id">
                  <strong>{a.name}</strong>
                  {isMe && <span className="adm-tag me">Vous</span>}
                  {a.isOwner && <span className="adm-tag owner">Propriétaire</span>}
                  <div className="muted small">{a.email}</div>
                </div>
                <div className="adm-role"><span className="adm-pill">{roleLabel(a.role)}</span></div>
                <div className="adm-state">
                  <Badge status={a.status} />
                  {a.totpEnabled ? <Badge status="validated">2FA active</Badge> : <Badge status="pending">2FA à configurer</Badge>}
                  {locked && <Badge status="contested">Verrouillé jusqu’à {dateTime(a.lockedUntil)}</Badge>}
                </div>
                <div className="adm-login">
                  <span className="muted small">Dernière connexion</span>
                  <span>{a.lastLoginAt ? dateTime(a.lastLoginAt) : 'Jamais'}</span>
                  {a.lastLoginIp && <span className="mono muted small">{a.lastLoginIp}</span>}
                </div>
                <div className="adm-actions">
                  {manageable && (
                    <ActionsMenu items={[
                      ['Modifier', () => setEditing(a)],
                      ['Réinitialiser le mot de passe', () => action(a, 'reset-password', '', `Réinitialiser le mot de passe de ${a.email} ?`)],
                      ['Réinitialiser la 2FA', () => action(a, 'reset-2fa', '2FA réinitialisée', `Réinitialiser la 2FA de ${a.email} ? Il devra la reconfigurer.`)],
                      ['Déconnecter partout', () => action(a, 'revoke-sessions', 'Sessions révoquées')],
                      ...(me.role === 'super_admin' ? [['Supprimer le compte', () => remove(a), true] as MenuItem] : []),
                    ]} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
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

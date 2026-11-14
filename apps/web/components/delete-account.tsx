'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from './icons';
import { ErrorBox, Modal, PasswordInput } from './ui';

/** Suppression définitive du compte, confirmée par le mot de passe. */
export function DeleteAccount({ onDeleted, redirect = '/bienvenue', who = 'client' }: { onDeleted?: () => void; redirect?: string; who?: 'client' | 'pro' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section className="danger-zone">
      <h3><Icon name="trash" />Supprimer mon compte</h3>
      <p>Vos informations personnelles seront effacées et vous ne pourrez plus vous connecter. Les factures déjà émises sont conservées, sans vos données, pour la comptabilité.</p>
      <button type="button" className="btn btn-danger-outline btn-block" onClick={() => setOpen(true)}>Supprimer définitivement mon compte</button>
      {open && (
        <Modal title="Supprimer mon compte" onClose={() => setOpen(false)}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true); setError(null);
            try {
              await api('/auth/me', { method: 'DELETE', body: { password } });
              onDeleted?.();
              router.replace(redirect);
            } catch (err: any) { setError(err.message); setBusy(false); }
          }}>
            <ul className="danger-list">
              <li>Profil, téléphone{who === 'pro' ? ', photo, documents et compte de reversement' : ', véhicules'} et notifications effacés.</li>
              <li>{who === 'pro' ? 'Vos propositions en attente sont retirées.' : 'Vos demandes en attente sont annulées.'}</li>
              <li>Cette action est <b>irréversible</b>.</li>
            </ul>
            <div className="field"><label htmlFor="dpw">Confirmez avec votre mot de passe</label><PasswordInput id="dpw" value={password} onChange={setPassword} /></div>
            <label className="radio-row" style={{ borderBottom: 0 }}><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /><span className="grow small">Je comprends que mon compte sera supprimé définitivement.</span></label>
            <ErrorBox error={error} />
            <button className="btn btn-danger-solid btn-block" style={{ marginTop: 12 }} disabled={busy || !confirm || !password}>{busy ? 'Suppression…' : 'Supprimer mon compte'}</button>
          </form>
        </Modal>
      )}
    </section>
  );
}

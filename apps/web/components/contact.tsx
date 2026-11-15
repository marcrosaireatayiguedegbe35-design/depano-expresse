'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { proName } from '@/lib/format';
import { Icon } from './icons';
import { useSession } from './session';
import { ErrorBox, Modal } from './ui';

const TOPICS = ['Révision / entretien', 'Amélioration du véhicule', 'Diagnostic', 'Pose ou réparation précise', 'Demande de prix'];

/**
 * Écrire à un professionnel hors urgence (révision, amélioration, travail précis).
 * La demande part dans son espace ; s'il l'accepte, la messagerie et l'appel s'ouvrent.
 */
export function ContactSheet({ pro, initialTopic, onClose }: { pro: any; initialTopic?: string; onClose: () => void }) {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [topic, setTopic] = useState(initialTopic ?? TOPICS[0]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <Modal title="Écrire au professionnel" onClose={onClose}>
        <p className="small text-2" style={{ marginBottom: 14 }}>Connectez-vous pour envoyer votre demande à {proName(pro)}.</p>
        <button className="btn btn-primary btn-block" onClick={() => router.push(`/connexion?next=${encodeURIComponent(`${pathname}?contact=1`)}`)}>Se connecter</button>
      </Modal>
    );
  }

  return (
    <Modal title={`Écrire à ${proName(pro)}`} onClose={onClose}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setError(null);
        try {
          const r = await api('/conversations', { method: 'POST', body: { professionalId: pro._id, topic, text: text.trim() } });
          router.push(`/compte/message?id=${r.id}`);
        } catch (err: any) { setError(err.message); setBusy(false); }
      }}>
        <p className="small text-2" style={{ marginBottom: 12 }}>Pour un besoin précis, hors urgence. Le professionnel reçoit votre demande ; s’il l’accepte, vous pourrez discuter et vous appeler.</p>
        <p className="ct-label">Objet</p>
        <div className="ct-topics">
          {TOPICS.map((t) => <button key={t} type="button" className={`ct-topic${topic === t ? ' on' : ''}`} onClick={() => setTopic(t)} aria-pressed={topic === t}>{t}</button>)}
          {initialTopic && !TOPICS.includes(initialTopic) && <button type="button" className={`ct-topic${topic === initialTopic ? ' on' : ''}`} onClick={() => setTopic(initialTopic)}>{initialTopic}</button>}
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="ct-msg">Votre message</label>
          <textarea id="ct-msg" required minLength={2} maxLength={1000} rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex. Vidange et contrôle des freins sur une Toyota Corolla 2012, je suis disponible samedi matin." />
        </div>
        <ErrorBox error={error} />
        <button className="btn btn-primary btn-block" disabled={busy || text.trim().length < 2}><Icon name="chatFill" />{busy ? 'Envoi…' : 'Envoyer la demande'}</button>
      </form>
    </Modal>
  );
}

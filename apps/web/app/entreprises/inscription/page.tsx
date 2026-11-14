'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Icon } from '@/components/icons';
import { Blob, PageHead } from '@/components/ds';
import { useSession } from '@/components/session';
import { ErrorBox, Loading, useToast } from '@/components/ui';

/** Demande d'inscription d'une entreprise (validée ensuite par l'administration). */
export default function CompanyApplyPage() {
  const { user, loading } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ name: '', activity: '', address: '', phone: '', website: '', description: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  useEffect(() => { if (!loading && !user) router.replace('/connexion?next=/entreprises/inscription'); }, [loading, user, router]);
  if (!user) return <div className="screen"><Loading /></div>;

  if (sent) {
    return (
      <div className="screen">
        <Blob />
        <PageHead title="Inscription envoyée" back="/entreprises" />
        <div className="empty">
          <div className="empty-art"><Icon name="checkCircle" /></div>
          <h2>Merci !</h2>
          <p>Votre demande a bien été transmise. Notre équipe vérifie les informations avant la publication de votre entreprise dans l’annuaire.</p>
          <Link href="/entreprises" className="btn btn-primary btn-md">Retour à l’annuaire</Link>
        </div>
      </div>
    );
  }

  const field = (k: keyof typeof f, label: string, icon: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="fcard indent">
      <div className="fcard-head"><Icon name={icon} /><label htmlFor={k}>{label}</label></div>
      <div className="finput blue"><input id={k} value={f[k]} onChange={(e) => set(k, e.target.value)} {...props} /></div>
    </div>
  );

  return (
    <form className="screen" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setError(null);
      try {
        await api('/companies/apply', {
          method: 'POST',
          body: { name: f.name, activity: f.activity, address: f.address, phone: `+229${f.phone.replace(/\D/g, '')}`, ...(f.website ? { website: f.website } : {}), ...(f.description ? { description: f.description } : {}) },
        });
        toast('Demande envoyée');
        setSent(true);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    }}>
      <Blob />
      <PageHead title="Inscrire mon entreprise" back="/entreprises" />
      <p className="text-2" style={{ marginBottom: 16 }}>Votre fiche sera publiée après vérification par notre équipe.</p>
      {field('name', 'Nom de l’entreprise', 'buildingFill', { required: true, minLength: 2, placeholder: 'Ex. : Garage du Centre' })}
      {field('activity', 'Activité', 'briefcase', { required: true, minLength: 2, placeholder: 'Ex. : Vente de pièces détachées' })}
      {field('address', 'Adresse', 'pinFill', { required: true, minLength: 3, placeholder: 'Quartier, rue, ville' })}
      <div className="fcard indent">
        <div className="fcard-head"><Icon name="phoneFill" /><label htmlFor="phone">Téléphone</label></div>
        <div className="frow">
          <select className="cc" aria-label="Indicatif" defaultValue="+229"><option value="+229">+229</option></select>
          <input id="phone" type="tel" inputMode="numeric" required pattern="[0-9 ]{8,14}" placeholder="01 XX XX XX XX" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
      </div>
      {field('website', 'Site internet (facultatif)', 'share', { type: 'url', placeholder: 'https://…' })}
      <div className="fcard indent">
        <div className="fcard-head"><Icon name="docFill" /><label htmlFor="description">Description (facultatif)</label></div>
        <div className="finput"><textarea id="description" maxLength={1000} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Présentez vos services" /></div>
      </div>
      <ErrorBox error={error} />
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer ma demande'}</button>
    </form>
  );
}

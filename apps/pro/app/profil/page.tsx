'use client';

import { useRouter } from 'next/navigation';
import { proName } from '@/lib/format';
import { Icon } from '@/components/icons';
import { AssistBanner, Blob, MenuCard } from '@/components/ds';
import { tradeLabel } from '@/components/pro';
import { useSession } from '@/components/session';

const VERIF: Record<string, string> = { pending: 'Documents à déposer', in_review: 'Vérification en cours', validated: 'Compte vérifié', rejected: 'Vérification refusée', suspended: 'Compte suspendu' };

/** Profil professionnel (même composition que « Mon Profil » client). */
export default function ProfilePage() {
  const { pro, logout, unread } = useSession();
  const router = useRouter();
  if (!pro) return null;
  const initials = `${pro.firstName?.[0] ?? ''}${pro.lastName?.[0] ?? ''}`.toUpperCase();
  return (
    <div className="screen">
      <Blob />
      <header className="profile-top">
        <span className="avatar-lg" style={pro.photoUrl ? { backgroundImage: `url(${pro.photoUrl})`, backgroundSize: 'cover' } : undefined}>{pro.photoUrl ? '' : initials}</span>
        <div className="grow">
          <h1 className="h-title">{proName(pro)}</h1>
          <p className="small" style={{ color: '#3d4a6a', marginTop: 4 }}>{tradeLabel(pro.trade)} · {pro.commune}</p>
          <span className={`badge-s ${pro.verificationStatus === 'validated' ? 'success' : pro.verificationStatus === 'rejected' || pro.verificationStatus === 'suspended' ? 'danger' : 'warning'}`} style={{ marginTop: 6 }}>
            {pro.verificationStatus === 'validated' && <Icon name="check" />}{VERIF[pro.verificationStatus]}
          </span>
        </div>
      </header>
      <div className="menu-list">
        <MenuCard href="/profil/infos" icon="userFill" title="Mon profil professionnel" sub="Atelier, services, horaires, tarifs, zone" />
        <MenuCard href="/profil/documents" icon="shieldFill" title="Documents de vérification" sub="Pièces exigées pour la validation du compte" />
        <MenuCard href="/contrat" icon="doc" title="Contrat de partenariat" sub={pro.contractSigned ? 'Signé · télécharger le PDF' : 'À signer'} />
        <MenuCard href="/profil/avis" icon="star" title="Avis clients" sub={pro.reviewsCount ? `${pro.rating?.toFixed(1)}/5 · ${pro.reviewsCount} avis` : 'Pas encore d’avis'} />
        <MenuCard href="/profil/reversement" icon="cardFill" title="Compte de reversement" sub={pro.payoutAccount?.msisdn ? `${pro.payoutAccount.operator?.toUpperCase()} · ${pro.payoutAccount.msisdn}` : 'Mobile Money à renseigner'} />
        <MenuCard href="/notifications" icon="bellFill" title="Notifications" sub="Demandes, choix des clients, paiements" count={unread} />
        <MenuCard href="/gains" icon="tag" title="Mes gains" sub="Paiements, commission, reversements" />
        <MenuCard href="/boutique" icon="cartFill" title="Boutique" sub="Pièces, outils et accessoires à commander" />
        <MenuCard href="/commandes" icon="clipboard" title="Mes commandes" sub="Suivi de vos achats en boutique" />
        <MenuCard href="/profil/securite" icon="lockFill" title="Sécurité et compte" sub="Mot de passe, suppression du compte" />
        <MenuCard href="/aide" icon="headsetFill" title="Aide & assistance" sub="Questions fréquentes des professionnels" />
        <MenuCard icon="logout" title="Déconnexion" sub="Quitter l’espace professionnel" onClick={async () => { await logout(); router.push('/connexion'); }} />
      </div>
      <div className="section"><AssistBanner compact title="Besoin d’aide ?" text="Notre équipe accompagne les professionnels partenaires." cta="Contacter" /></div>
    </div>
  );
}

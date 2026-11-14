'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IMAGES } from '@/lib/images';
import { Icon } from '@/components/icons';
import { AssistBanner, Blob, ImgOr, MenuCard, Skyline } from '@/components/ds';
import { useCart, useSession } from '@/components/session';
import { Loading, useFetch } from '@/components/ui';

/** Onglet « Profil » : non connecté (maquette 11) / connecté (maquette 17). */
export default function ProfileTab() {
  const { user, loading, logout } = useSession();
  const router = useRouter();
  const { count } = useCart();
  const notifs = useFetch<any>(user ? '/notifications?limit=1' : null);

  if (loading) return <div className="screen"><Loading rows={4} height={70} /></div>;

  if (!user) {
    return (
      <div className="screen">
        <Blob />
        <header className="hero-head">
          <div className="txt">
            <h1 className="title-xl">Bienvenue ! <span aria-hidden>👋</span></h1>
            <p className="sub">Connectez-vous pour demander une intervention, suivre vos factures et vos commandes.</p>
          </div>
          <div className="art"><img src={IMAGES.profile.advisor} alt="Conseillère Depanno Expresse" /></div>
        </header>
        <div className="stack">
          <Link href="/connexion" className="btn btn-primary btn-block"><Icon name="login" />Se connecter</Link>
          <Link href="/inscription" className="btn btn-outline btn-block"><Icon name="userPlusFill" />Créer un compte</Link>
        </div>
        <div className="section menu-list">
          <MenuCard href="/marketplace" icon="cartFill" title="Marketplace" sub="Pièces, pneus, batteries et accessoires" />
          <MenuCard href="/entreprises" icon="buildingFill" title="Annuaire des entreprises" sub="Garages, concessionnaires, assureurs" violet />
          <MenuCard href="/actualites" icon="megaphone" title="Publicités & actualités" sub="Offres et conseils automobiles" />
          <MenuCard href="/aide" icon="help" title="Aide & FAQ" sub="Questions fréquentes, assistance" violet />
        </div>
        <Skyline />
      </div>
    );
  }

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
  const unread = notifs.data?.unread ?? 0;

  return (
    <div className="screen">
      <Blob />
      <header className="profile-top">
        <span className="avatar-lg">{initials}</span>
        <div className="grow">
          <h1 className="h-title">Mon Profil</h1>
          <p className="small" style={{ color: '#3d4a6a', marginTop: 4 }}>{user.firstName} {user.lastName}<br />{user.email}</p>
        </div>
        <ImgOr src={IMAGES.profile.car} icon="carFill" alt="" className="profile-car" fit="contain" />
        <Link href="/compte/securite" className="round-btn circle gear" aria-label="Paramètres"><Icon name="settings" /></Link>
      </header>

      <div className="menu-list">
        <MenuCard href="/compte/profil" icon="userFill" title="Mon profil" sub="Consultez et modifiez vos informations" />
        <MenuCard href="/compte/demandes" icon="wrench" title="Mes demandes" sub="Suivez vos demandes d’intervention" />
        <MenuCard href="/compte/interventions" icon="docFill" title="Interventions & factures" sub="Devis, factures, paiements et avis" />
        <MenuCard href="/compte/commandes" icon="bag" title="Mes commandes" sub="Commandes de la marketplace" />
        <MenuCard href="/panier" icon="cartFill" title="Mon panier" sub="Articles en attente de commande" count={count} />
        <MenuCard href="/compte/securite" icon="shieldFill" title="Mes informations de sécurité" sub="Protégez votre compte" />
        <MenuCard href="/compte/notifications" icon="bellFill" title="Notifications & alertes" sub="Gérez vos notifications" count={unread} />
        <MenuCard href="/compte/interventions" icon="star" title="Mes avis & évaluations" sub="Notez vos interventions terminées" />
        <MenuCard href="/compte/vehicules" icon="carFill" title="Mes véhicules" sub="Gérez vos véhicules" />
        <MenuCard href="/entreprises" icon="buildingFill" title="Annuaire des entreprises" sub="Garages, concessionnaires, assureurs" />
        <MenuCard href="/actualites" icon="megaphone" title="Publicités & actualités" sub="Offres et conseils automobiles" />
        <MenuCard href="/aide" icon="headsetFill" title="Assistance & service client" sub="Contactez notre équipe" />
        <MenuCard href="/confidentialite" icon="doc" title="Politique de confidentialité" sub="Découvrez notre politique" />
        <MenuCard href="/a-propos" icon="info" title="À propos de la plateforme" sub="En savoir plus sur Depanno Expresse" />
        <MenuCard icon="logout" title="Déconnexion" sub="Quittez votre compte" onClick={async () => { await logout(); router.push('/bienvenue'); }} />
      </div>

      <div className="section"><AssistBanner compact title="Besoin d’aide ?" text="Notre équipe est là pour vous aider à tout moment." cta="Contacter" /></div>
    </div>
  );
}

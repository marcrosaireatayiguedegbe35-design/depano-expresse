import { PageHead } from '@/components/ds';

const SECTIONS: [string, string][] = [
  ['Données collectées', 'Nom, prénom, e-mail, téléphone et commune lors de l’inscription ; vos véhicules si vous les enregistrez ; vos demandes, interventions, factures, commandes et avis.'],
  ['Position', 'Votre position (GPS si vous l’autorisez, sinon la commune choisie) sert uniquement à trouver les professionnels proches. Votre position exacte n’est transmise qu’aux professionnels que vous sollicitez.'],
  ['Utilisation', 'Vos données servent à traiter vos demandes d’intervention et vos commandes, à vous envoyer les codes de vérification et les notifications liées à votre compte, et à assurer la sécurité de la plateforme (journal des opérations).'],
  ['Stockage sur votre appareil', 'Un cookie de session sécurisé maintient votre connexion. Votre panier, vos favoris et votre position choisie sont enregistrés uniquement dans votre navigateur.'],
  ['Partage', 'Les informations nécessaires à une intervention sont partagées avec le professionnel concerné. Aucune donnée n’est vendue à des tiers.'],
  ['Vos droits', 'Vous pouvez consulter et modifier vos informations dans « Mon profil » et supprimer votre compte depuis « Sécurité & paramètres ». Pour toute question, contactez l’assistance depuis la page Aide.'],
];

export default function PrivacyPage() {
  return (
    <div className="screen">
      <PageHead title="Confidentialité" back="/compte" />
      {SECTIONS.map(([t, d]) => (
        <section key={t} className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 16 }}>{t}</h2>
          <p className="about expanded" style={{ marginTop: 6, fontSize: 14 }}>{d}</p>
        </section>
      ))}
    </div>
  );
}

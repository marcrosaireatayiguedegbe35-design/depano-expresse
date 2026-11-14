import Link from 'next/link';
import { PageHead } from '@/components/ds';
import { Icon } from '@/components/icons';
import { IMAGES } from '@/lib/images';

export const metadata = { title: 'À propos' };

const OFFER = [
  { icon: 'tow', title: 'Dépannage et réparation', text: 'Mécaniciens, vulcanisateurs, électriciens auto, remorqueurs et soudeurs vérifiés, près de vous.' },
  { icon: 'shop', title: 'Boutique de pièces', text: 'Pièces et accessoires livrés chez vous, payables à la livraison.' },
  { icon: 'building', title: 'Entreprises', text: 'Garages et sociétés partenaires pour l’entretien de vos véhicules.' },
] as const;

const STEPS = [
  { title: 'Décrivez votre problème', text: 'Choisissez une ou plusieurs pannes, ou écrivez ce qui se passe.' },
  { title: 'Choisissez un professionnel', text: 'Il accepte votre demande et l’intervention commence.' },
  { title: 'Suivez son arrivée en direct', text: 'Vous voyez sa position sur la carte et confirmez chaque étape.' },
  { title: 'Vérifiez la facture', text: 'Acceptez-la, ou contestez-la : le pro la corrige ou l’administration tranche.' },
  { title: 'Payez, puis notez', text: 'En espèces ou par Mobile Money, puis donnez votre avis.' },
];

const PROMISES = [
  { icon: 'shieldFill', title: 'Pros vérifiés', text: 'Pièces d’identité et documents contrôlés avant validation.' },
  { icon: 'docFill', title: 'Facture claire', text: 'Le détail de chaque ligne, avant tout paiement.' },
  { icon: 'starOutline', title: 'Avis authentiques', text: 'Seuls les clients ayant payé une intervention peuvent noter.' },
] as const;

export default function AboutPage() {
  return (
    <div className="screen ab">
      <PageHead title="À propos" back="/compte" />

      <section className="ab-hero">
        <span className="ab-logo"><img src={IMAGES.brand.logo} alt="" /></span>
        <h2>Depanno <em>Expresse</em></h2>
        <p>Un professionnel vérifié pour votre véhicule, partout au Bénin, à toute heure.</p>
      </section>

      <section className="section">
        <div className="dc-sec"><h2>Ce que nous proposons</h2></div>
        <div className="ab-offer">
          {OFFER.map((o) => (
            <div key={o.title} className="ab-card">
              <span className="ic"><Icon name={o.icon} /></span>
              <span className="grow"><b>{o.title}</b><small>{o.text}</small></span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="dc-sec"><h2>Comment ça marche</h2></div>
        <ol className="ab-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}><span className="n">{i + 1}</span><span className="grow"><b>{s.title}</b><small>{s.text}</small></span></li>
          ))}
        </ol>
      </section>

      <section className="section">
        <div className="dc-sec"><h2>Nos engagements</h2></div>
        <div className="ab-promises">
          {PROMISES.map((p) => (
            <div key={p.title} className="ab-promise"><span className="ic"><Icon name={p.icon} /></span><b>{p.title}</b><small>{p.text}</small></div>
          ))}
        </div>
      </section>

      <div className="ab-links section">
        <Link href="/aide" className="ab-link"><Icon name="help" /><span className="grow">Aide &amp; FAQ</span><Icon name="chevR" /></Link>
        <Link href="/confidentialite" className="ab-link"><Icon name="lock" /><span className="grow">Politique de confidentialité</span><Icon name="chevR" /></Link>
      </div>
    </div>
  );
}

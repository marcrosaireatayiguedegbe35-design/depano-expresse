import { AssistBanner, PageHead } from '@/components/ds';

export const metadata = { title: 'Aide & FAQ' };

const FAQ: [string, string][] = [
  ['Comment trouver un professionnel ?', 'Ouvrez « Dépannage », choisissez le métier et le problème, puis votre position. Les professionnels vérifiés les plus proches et disponibles s’affichent en premier, en liste ou sur la carte.'],
  ['Qu’est-ce qu’une demande groupée ?', 'Vous envoyez la même demande à plusieurs professionnels (jusqu’à 5). Vous comparez leurs propositions et vous choisissez librement. Les autres sont prévenus automatiquement.'],
  ['Quand dois-je payer ?', 'Jamais avant d’avoir vu la facture détaillée (pièces, main-d’œuvre, frais) et confirmé le montant. Vous pouvez aussi contester : le paiement est alors suspendu et notre équipe traite le litige.'],
  ['Les professionnels sont-ils vérifiés ?', 'Oui. Leur identité et leurs documents sont contrôlés par notre équipe avant qu’ils puissent recevoir des demandes.'],
  ['Qui peut laisser un avis ?', 'Uniquement les clients ayant réellement payé une intervention, une seule fois par intervention.'],
  ['Comment est utilisée ma position ?', 'Uniquement pour trouver les professionnels proches. Votre position exacte n’est transmise qu’aux professionnels que vous sollicitez.'],
  ['Je n’ai pas reçu le code à 6 chiffres', 'Vérifiez vos courriers indésirables, puis utilisez « Renvoyer » après 60 secondes. Le code est valable 10 minutes.'],
];

export default function HelpPage() {
  return (
    <div className="screen">
      <PageHead title="Aide & FAQ" back="/compte" />
      {FAQ.map(([q, a]) => (
        <details key={q} className="desc-card" style={{ marginBottom: 10 }}>
          <summary style={{ fontSize: 15 }}>{q}<svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg></summary>
          <p className="body small">{a}</p>
        </details>
      ))}
      <div className="section"><AssistBanner /></div>
    </div>
  );
}

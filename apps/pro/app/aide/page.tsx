import { AssistBanner, PageHead } from '@/components/ds';

const FAQ: [string, string][] = [
  ['Comment recevoir des demandes ?', 'Votre compte doit être validé (documents vérifiés), puis passez votre statut en « Disponible » depuis l’accueil. Les clients proches de votre position vous trouvent selon votre métier.'],
  ['Demande directe ou groupée ?', 'Une demande directe vous est adressée à vous seul. Une demande groupée est envoyée à plusieurs professionnels : le client choisit parmi les propositions reçues.'],
  ['Comment se passe une intervention ?', 'Une fois choisi, indiquez « En route », « Arrivé », puis « En cours ». Sur place, créez la facture détaillée : le client la confirme avant de payer.'],
  ['Quand suis-je payé ?', 'Le client paie après avoir confirmé votre facture. Votre part nette (montant moins la commission sur les prestations, hors pièces) est reversée sur votre compte Mobile Money.'],
  ['Et si le client conteste ?', 'Le paiement est suspendu et notre équipe examine le litige. Si elle demande une nouvelle version, vous pourrez soumettre une facture corrigée.'],
];

export default function HelpPage() {
  return (
    <div className="screen">
      <PageHead title="Aide" back="/profil" />
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

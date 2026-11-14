import Link from 'next/link';
import { PageHead, Perks } from '@/components/ds';
import { IMAGES } from '@/lib/images';

export const metadata = { title: 'À propos' };

export default function AboutPage() {
  return (
    <div className="screen">
      <PageHead title="À propos" back="/compte" />
      <img src={IMAGES.brand.full} alt="Depanno Expresse" style={{ display: 'block', width: 220, maxWidth: '70%', margin: '10px auto 20px' }} />
      <div className="card">
        <p className="about expanded">Depanno Expresse met en relation les automobilistes du Bénin avec des professionnels vérifiés — mécaniciens, vulcanisateurs, électriciens auto, remorqueurs et soudeurs — ainsi qu’avec des entreprises et une marketplace de pièces et accessoires.</p>
        <p className="about expanded" style={{ marginTop: 10 }}>Vous voyez le devis et la facture détaillée avant de payer, vous pouvez contester un montant, et seuls les clients ayant payé une intervention peuvent laisser un avis.</p>
      </div>
      <div className="section"><Perks items={[{ icon: 'shieldFill', label: <>Pros<br />vérifiés</> }, { icon: 'bolt', label: <>Intervention<br />rapide</> }, { icon: 'docFill', label: <>Factures<br />détaillées</> }]} /></div>
      <div className="stack section">
        <Link href="/confidentialite" className="btn btn-outline btn-block">Politique de confidentialité</Link>
        <Link href="/aide" className="btn btn-light btn-block">Aide &amp; FAQ</Link>
      </div>
    </div>
  );
}

/** Opérateurs Mobile Money du Bénin et leurs logos (public/images/operators). Utilisés pour le compte de
 *  reversement des professionnels et, plus tard, pour le paiement. */
export const OPERATORS: { id: 'mtn' | 'moov' | 'celtiis'; label: string; logo: string }[] = [
  { id: 'mtn', label: 'MTN MoMo', logo: '/images/operators/mtn.png' },
  { id: 'moov', label: 'Moov Money', logo: '/images/operators/moov.png' },
  { id: 'celtiis', label: 'Celtiis Cash', logo: '/images/operators/celtiis.png' },
];

export const operatorOf = (id?: string) => OPERATORS.find((o) => o.id === id);

/** Logo carré arrondi d'un opérateur ; rien si l'opérateur est inconnu. */
export function OperatorLogo({ id, size = 28 }: { id?: string; size?: number }) {
  const op = operatorOf(id);
  if (!op) return null;
  return <img className="op-logo" src={op.logo} alt={op.label} width={size} height={size} style={{ width: size, height: size }} />;
}

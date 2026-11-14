/**
 * Indique si une entreprise est ouverte d'après son texte d'horaires (« 08:00-18:00 », « 8h - 18h30 »…).
 * Renvoie `null` quand les horaires ne sont pas exploitables : aucun statut n'est alors affiché.
 */
export function openNow(hours?: string | null, now = new Date()): boolean | null {
  if (!hours) return null;
  if (/24\s*h?\s*\/\s*24|24h\/24/i.test(hours)) return true;
  const m = hours.match(/(\d{1,2})\s*[h:]\s*(\d{2})?\s*[-–à]+\s*(\d{1,2})\s*[h:]\s*(\d{2})?/i);
  if (!m) return null;
  const open = Number(m[1]) * 60 + Number(m[2] ?? 0);
  const close = Number(m[3]) * 60 + Number(m[4] ?? 0);
  const t = now.getHours() * 60 + now.getMinutes();
  if (/dim/i.test(hours) === false && now.getDay() === 0 && /lun.*sam/i.test(hours)) return false;
  return close > open ? t >= open && t < close : t >= open || t < close;
}

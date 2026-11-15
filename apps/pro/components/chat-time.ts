/* Dates des messages : « 14:32 », « Hier », « lun. », « 12 nov. ». */
const dayDiff = (d: Date) => Math.floor((new Date(new Date().toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);

/** Liste des conversations : heure si aujourd'hui, « Hier », jour de la semaine, puis date courte. */
export const when = (d?: string) => {
  if (!d) return '';
  const t = new Date(d); const days = dayDiff(t);
  if (days <= 0) return t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Hier';
  if (days < 7) return t.toLocaleDateString('fr-FR', { weekday: 'short' });
  return t.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

/** Séparateur de jour dans une discussion. */
export const dayLabel = (d: string) => {
  const t = new Date(d); const days = dayDiff(t);
  if (days <= 0) return 'Aujourd’hui';
  if (days === 1) return 'Hier';
  return t.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const clock = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Regroupe les messages par jour, et marque le premier d'une suite du même auteur. */
export function threadOf<T extends { at: string; from: string }>(messages: T[]) {
  const out: { day?: string; m: T; first: boolean; last: boolean }[] = [];
  messages.forEach((m, i) => {
    const prev = messages[i - 1]; const next = messages[i + 1];
    const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
    const sameNext = !!next && next.from === m.from && new Date(next.at).toDateString() === new Date(m.at).toDateString();
    out.push({ day: newDay ? dayLabel(m.at) : undefined, m, first: newDay || prev.from !== m.from, last: !sameNext });
  });
  return out;
}

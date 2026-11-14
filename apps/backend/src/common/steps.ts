/** Étapes d'une intervention que le client doit confirmer, et l'étape précédente en cas de refus. */
export const CONFIRMABLE: Record<string, { previous: string; ask: string; confirmed: string }> = {
  on_site: { previous: 'en_route', ask: 'Le professionnel indique être arrivé : confirmez-vous ?', confirmed: 'Arrivée confirmée par le client' },
  in_progress: { previous: 'on_site', ask: 'Le professionnel indique avoir commencé les travaux : confirmez-vous ?', confirmed: 'Début des travaux confirmé par le client' },
  completed: { previous: 'in_progress', ask: 'Le professionnel indique avoir terminé : confirmez-vous ?', confirmed: 'Fin des travaux confirmée par le client' },
};

/** Position GPS acceptée pendant le trajet et jusqu'à la confirmation de l'arrivée. */
export const TRACKING_STATUSES = ['accepted', 'en_route', 'on_site'];

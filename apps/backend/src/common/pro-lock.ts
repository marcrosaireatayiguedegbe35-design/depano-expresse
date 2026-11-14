import { ClientSession, Model, Types } from 'mongoose';

/**
 * Règle « une intervention à la fois » : un professionnel est engagé du moment où un client le choisit
 * jusqu'à la confirmation de la fin des travaux (ou l'annulation). Le verrou est porté par
 * Professional.activeInterventionId et posé par une mise à jour atomique : deux clients qui choisissent
 * le même professionnel au même instant ne peuvent pas l'obtenir tous les deux.
 */
export function isEngaged(i?: { status?: string; awaitingConfirmation?: string | null } | null) {
  if (!i) return false;
  if (['accepted', 'en_route', 'on_site', 'in_progress'].includes(i.status ?? '')) return true;
  return i.status === 'completed' && i.awaitingConfirmation === 'completed';
}

/** Intervention en cours du professionnel (null s'il est libre). Nettoie un verrou périmé au passage. */
export async function currentEngagement(pros: Model<any>, interventions: Model<any>, proId: Types.ObjectId | string, session?: ClientSession) {
  const p = await pros.findById(proId).select('activeInterventionId').session(session ?? null).lean<any>();
  if (!p?.activeInterventionId) return null;
  const i = await interventions.findById(p.activeInterventionId).select('reference status awaitingConfirmation problem').session(session ?? null).lean<any>();
  if (isEngaged(i)) return i;
  await pros.updateOne({ _id: proId, activeInterventionId: p.activeInterventionId }, { $unset: { activeInterventionId: 1 } }, { session });
  return null;
}

/** Engage le professionnel sur une intervention ; renvoie false s'il est déjà pris. */
export async function engagePro(pros: Model<any>, interventions: Model<any>, proId: Types.ObjectId, interventionId: Types.ObjectId, session: ClientSession) {
  if (await currentEngagement(pros, interventions, proId, session)) return false;
  const r = await pros.updateOne(
    { _id: proId, $or: [{ activeInterventionId: null }, { activeInterventionId: { $exists: false } }] },
    { activeInterventionId: interventionId, availability: 'busy' },
    { session },
  );
  return r.modifiedCount > 0;
}

/** Libère le professionnel à la fin (ou à l'annulation) de cette intervention et le remet disponible. */
export async function releasePro(pros: Model<any>, proId: Types.ObjectId | string, interventionId: Types.ObjectId | string, session?: ClientSession) {
  await pros.updateOne(
    { _id: proId, activeInterventionId: new Types.ObjectId(String(interventionId)) },
    { $unset: { activeInterventionId: 1 }, availability: 'available' },
    { session },
  );
}

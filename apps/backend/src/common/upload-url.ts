import { registerDecorator, ValidationOptions } from 'class-validator';

/** Formats acceptés par Cloudinary pour les envois signés par l'API. */
export const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,gif,heic,heif';

/**
 * Adresse d'une image envoyée par la plateforme : uniquement le compte Cloudinary du projet.
 * Empêche d'enregistrer des liens vers des sites tiers (pistage des administrateurs qui ouvrent la photo,
 * contenus piégés, fausses pièces hébergées ailleurs).
 */
export function isUploadUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.hostname !== 'res.cloudinary.com' || u.port || u.username || u.password) return false;
    const cloud = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    return !cloud || u.pathname.startsWith(`/${cloud}/`);
  } catch {
    return false;
  }
}

/** Décorateur de validation : `@IsUploadUrl()` ou `@IsUploadUrl({ each: true })` pour une liste. */
export function IsUploadUrl(options?: ValidationOptions) {
  return (target: object, propertyName: string) => registerDecorator({
    name: 'isUploadUrl', target: target.constructor, propertyName,
    options: { message: 'Image invalide : envoyez la photo depuis l’application', ...options },
    validator: { validate: (v: unknown) => isUploadUrl(v) },
  });
}

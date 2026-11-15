/** Image d'une catégorie, d'un service ou d'un problème.
 *  Les visuels fournis avec le site sont des détourages (affichés en entier) ;
 *  les images envoyées depuis le back-office sont des photos : elles remplissent
 *  leur cadre arrondi, recadrées au centre et servies à la bonne taille. */
export const isPhoto = (u?: string | null) => !!u && !u.startsWith('/');

export function sized(u: string, px: number) {
  const m = u.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/);
  if (!m) return u;
  const s = Math.round(px * 2);
  return `${m[1]}c_fill,g_auto,w_${s},h_${s},f_auto,q_auto/${m[2]}`;
}

export function Art({ src, size = 80, alt = '' }: { src: string; size?: number; alt?: string }) {
  if (!isPhoto(src)) return <img src={src} alt={alt} />;
  return <img className="photo" src={sized(src, size)} alt={alt} loading="lazy" />;
}

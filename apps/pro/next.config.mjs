// Sur Vercel ou Netlify, l'API de production est utilisée si BACKEND_URL n'est pas défini (variable lue à la compilation).
const BACKEND = (process.env.BACKEND_URL || ((process.env.VERCEL || process.env.NETLIFY) ? 'https://depano-expresse-aq3o.vercel.app' : 'http://localhost:4000')).replace(/\/$/, '');

// Cloudflare Pages (CF_PAGES=1 pendant la construction) : export en fichiers statiques. Le relais /api et les en-têtes
// de sécurité y sont assurés par functions/api/[[path]].js et public/_headers. Ailleurs, Next.js relaie /api lui-même.
const STATIC = process.env.CF_PAGES === '1' || process.env.STATIC_EXPORT === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  // Même origine pour l'API : cookie de session httpOnly, pas de CORS côté navigateur.
  ...(STATIC ? { output: 'export' } : {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND}/pro/:path*` }];
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(self)' },
      ],
    }];
  },
  }),
};
export default nextConfig;

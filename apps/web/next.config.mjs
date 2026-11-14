// Sur Vercel, l'API de production est utilisée si BACKEND_URL n'est pas défini (variable lue à la compilation).
const BACKEND = (process.env.BACKEND_URL || (process.env.VERCEL ? 'https://depano-expresse-aq3o.vercel.app' : 'http://localhost:4000')).replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  // Même origine pour l'API : cookie de session httpOnly, pas de CORS côté navigateur.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND}/client/:path*` }];
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
      ],
    }];
  },
};
export default nextConfig;

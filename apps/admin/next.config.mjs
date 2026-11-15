// Sur Vercel ou Netlify, l'API de production est utilisée si BACKEND_URL n'est pas défini (variable lue à la compilation).
const BACKEND = (process.env.BACKEND_URL || ((process.env.VERCEL || process.env.NETLIFY) ? 'https://depano-expresse-aq3o.vercel.app' : 'http://localhost:4000')).replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Le navigateur ne parle qu'à ce domaine : le cookie de session reste same-site et httpOnly.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND}/admin/:path*` }];
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'same-origin' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};
export default nextConfig;

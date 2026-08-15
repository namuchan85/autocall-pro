import type { NextConfig } from 'next';

const apiOrigin = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/auth/:path*',
        destination: `${apiOrigin}/auth/:path*`,
      },
      {
        source: '/customers',
        destination: `${apiOrigin}/customers`,
      },
      {
        source: '/customers/:path*',
        destination: `${apiOrigin}/customers/:path*`,
      },
      {
        source: '/telephony/:path*',
        destination: `${apiOrigin}/telephony/:path*`,
      },
    ];
  },
};

export default nextConfig;

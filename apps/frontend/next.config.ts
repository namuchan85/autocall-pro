import path from 'node:path';
import type { NextConfig } from 'next';

const apiOrigin = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
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
      {
        source: '/settings',
        destination: `${apiOrigin}/settings`,
      },
      {
        source: '/settings/:path*',
        destination: `${apiOrigin}/settings/:path*`,
      },
    ];
  },
};

export default nextConfig;

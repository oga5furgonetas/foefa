/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@histor/core'],
  serverExternalPackages: ['sharp', 'postgres', 'pino', 'web-push', 'stripe', 'ioredis', '@anthropic-ai/sdk'],
  output: 'standalone',
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: '**.r2.dev' },
    ],
  },
  async headers() {
    return [
      { source: '/fonts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/sw.js', headers: [{ key: 'Service-Worker-Allowed', value: '/' }, { key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
  webpack(config) {
    // El núcleo se escribe en TS con imports sin extensión.
    config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] };
    return config;
  },
};

export default nextConfig;

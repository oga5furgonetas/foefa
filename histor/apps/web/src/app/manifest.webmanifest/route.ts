export function GET() {
  return Response.json(
    {
      name: 'Histor',
      short_name: 'Histor',
      description: 'Verified news, no shortcuts.',
      start_url: '/',
      display: 'standalone',
      background_color: '#fbfaf7',
      theme_color: '#15171c',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      ],
    },
    { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=86400' } },
  );
}

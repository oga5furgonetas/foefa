import { demoMode } from '@histor/core/services/content';
import { robotsTxt } from '@histor/core/seo/index';

export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(robotsTxt({ demo: demoMode() }), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

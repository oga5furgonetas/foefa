/**
 * Servidor local de feeds DEMO (http://127.0.0.1:4545/feeds/{slug}.xml).
 * Sirve para probar el worker de punta a punta sin red externa:
 *   DEMO_PHASE=2 npm run fixtures -w @histor/worker
 * Todo lo que sirve es ficticio y está marcado como DEMO.
 */
import http from 'node:http';
import { renderDemoFeed } from '@histor/core/demo/scenario';

const port = Number(process.env.FIXTURES_PORT) || 4545;
http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    if (url.pathname === '/robots.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end('User-agent: *\nAllow: /\n');
    }
    const m = url.pathname.match(/^\/feeds\/([a-z0-9-]+)\.(xml|json)$/);
    const feed = m ? renderDemoFeed(m[1], new Date(), process.env.DEMO_PHASE === '2' ? 2 : 1) : null;
    if (!feed) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'content-type': feed.contentType });
    res.end(feed.body);
  })
  .listen(port, '127.0.0.1', () => console.log(`Feeds DEMO en http://127.0.0.1:${port}/feeds/<slug>.xml`));

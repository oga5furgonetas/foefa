/**
 * Empaqueta el worker y la CLI en dist/ con el núcleo (@histor/core) dentro;
 * las dependencias de terceros quedan externas (se instalan con npm ci).
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts', 'src/cli.ts', 'src/fixtures/server.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  plugins: [
    {
      name: 'externals-menos-el-nucleo',
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) => (args.path.startsWith('@histor/') ? undefined : { path: args.path, external: true }));
      },
    },
  ],
});

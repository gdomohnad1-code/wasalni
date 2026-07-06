import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function prerender() {
  const serverPath = join(__dirname, '..', 'dist', 'server', 'index.mjs');
  const outputPath = join(__dirname, '..', 'dist', 'client', 'index.html');

  const mod = await import(serverPath);
  const req = new Request('http://localhost/');
  const env = {
    ASSETS: {
      fetch: async () => new Response(null, { status: 404 }),
    },
  };
  const ctx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  };

  const res = await mod.default.fetch(req, env, ctx);
  const html = await res.text();
  writeFileSync(outputPath, html, 'utf-8');
  console.log(`Prerendered ${html.length} bytes to ${outputPath}`);
}

prerender().catch((err) => {
  console.error('Prerender failed:', err);
  process.exit(1);
});

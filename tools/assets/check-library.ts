// Shape check of the parts library: `npm run parts:check` (`-- --shots` also writes PNGs to tools/assets/out/).
// Renders each library part and its source nodes as silhouettes from 6 directions in headless Chromium (check-page.html),
// prints one line per part and fails on a bad overlap, a box difference, a mirror/bar error or a budget overrun.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const here = path.join(root, 'tools/assets');
const shots = process.argv.includes('--shots');

const MIN_OVERLAP = 0.97, MAX_BOX_MM = 0.5, MAX_MIRROR_MM = 1, MAX_TRIS = 35000, MAX_BYTES = 1.5 * 1024 * 1024;

const types: Record<string, string> = { '.js': 'text/javascript', '.html': 'text/html', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.json': 'application/json', '.bin': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, s) => {
  const u = decodeURIComponent((q.url ?? '/').split('?')[0]);
  const f = u.startsWith('/repo/') ? path.join(root, u.slice(6)) : path.join(here, u === '/' ? 'check-page.html' : u);
  fs.readFile(f, (e, b) => {
    if (e) { s.writeHead(404); s.end(); return; }
    s.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' });
    s.end(b);
  });
}).listen(0);
const port = (srv.address() as { port: number }).port;

const failures: string[] = [];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 512 } });
  page.on('pageerror', (e) => { console.log('page error:', e.message); failures.push('page error'); });
  page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction('window.ready === true', null, { timeout: 60000 });
  const res = await page.evaluate((w) => (window as any).runCheck(w), shots);

  console.log('part              tris   worst dir  overlap  box diff mm');
  for (const p of res.parts) {
    const bad = p.overlap < MIN_OVERLAP || p.boxDiffMm > MAX_BOX_MM;
    console.log(`${p.name.padEnd(16)} ${String(p.tris).padStart(5)}   ${p.worst.padEnd(8)}   ${p.overlap.toFixed(4)}   ${p.boxDiffMm.toFixed(2)}${bad ? '   <-- FAIL' : ''}`);
    if (p.overlap < MIN_OVERLAP) failures.push(`${p.name}: overlap ${p.overlap.toFixed(4)} in ${p.worst} (min ${MIN_OVERLAP})`);
    if (p.boxDiffMm > MAX_BOX_MM) failures.push(`${p.name}: box differs by ${p.boxDiffMm.toFixed(2)} mm (max ${MAX_BOX_MM})`);
  }
  console.log(`grips mirror: ${res.mirror.diffMm.toFixed(2)} mm (max ${MAX_MIRROR_MM})`);
  if (res.mirror.diffMm > MAX_MIRROR_MM) failures.push(`grips are not mirror images: ${res.mirror.diffMm.toFixed(2)} mm`);
  console.log(`bar: width ${res.bar.widthMm.toFixed(0)} mm, centre z ${res.bar.centreMm.toFixed(2)} mm, ends differ in x ${res.bar.endDxMm.toFixed(2)} mm, in y ${res.bar.endDyMm.toFixed(2)} mm`);
  for (const [k, v] of [['centre', Math.abs(res.bar.centreMm)], ['ends in x', res.bar.endDxMm], ['ends in y', res.bar.endDyMm]] as [string, number][])
    if (v > MAX_MIRROR_MM) failures.push(`bar not level/straight across: ${k} ${v.toFixed(2)} mm`);

  if (shots) {
    const out = path.join(here, 'out');
    fs.mkdirSync(out, { recursive: true });
    for (const [name, url] of Object.entries(res.shots as Record<string, string>)) fs.writeFileSync(path.join(out, `part-${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
    console.log(`wrote ${Object.keys(res.shots).length} PNGs to tools/assets/out/ (original left, library right)`);
  }
} finally {
  await browser.close();
  srv.close();
}

const meta = JSON.parse(fs.readFileSync(path.join(root, 'player/public/parts/library.json'), 'utf8'));
const bytes = fs.statSync(path.join(root, 'player/public/parts/library.glb')).size;
console.log(`budget: ${meta.totalTriangles} triangles (max ${MAX_TRIS}), library.glb ${(bytes / 1024).toFixed(0)} KB (max ${MAX_BYTES / 1024})`);
if (meta.totalTriangles > MAX_TRIS) failures.push(`library has ${meta.totalTriangles} triangles (max ${MAX_TRIS})`);
if (bytes > MAX_BYTES) failures.push(`library.glb is ${bytes} bytes (max ${MAX_BYTES})`);

if (failures.length) {
  console.log('\nFAILED:\n' + failures.map((f) => '  ' + f).join('\n'));
  process.exit(1);
}
console.log('\nOK');

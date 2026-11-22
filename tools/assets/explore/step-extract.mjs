// Cut named parts out of a huge STEP assembly, keeping their place in the assembly, and turn them into a small GLB.
//
//   node tools/assets/explore/step-extract.mjs --in <file.step> --match <regex> --out <path without extension>
//        [--exclude <regex>] [--dry] [--no-glb] [--deflection 0.001] [--scale 0.001]
//
//   --match       regex tested against the STEP product (part / assembly) names. A matched assembly brings all its parts;
//                 then only parts inside that assembly count. With no assembly matched, every instance of a matched part counts.
//   --exclude     regex: products with a matching name are left out, with everything below them (e.g. "screw|washer|nut|spring")
//   --dry         only index the file and print what would be kept (no output files)
//   --no-glb      write only <out>.step (the small STEP), skip the mesh conversion
//   --deflection  tessellation tolerance as a share of each part's bounding box (default 0.001)
//   --angular     largest angle in radians between neighbouring triangles on a curve (default 0.5)
//   --scale       multiplier on the mesh coordinates: the STEP is in mm, glTF is metres, so 0.001 (default)
// Fine simplification (per-part ratios) is not done here; the parts library build does it (tools/assets/library.yaml).
//
// Stage 1 needs only Node: it indexes the STEP text (about a minute for 400 MB), works out which products are
// wanted, their ancestors in the assembly tree (only for the placement), and everything their geometry refers to,
// then writes those entities to <out>.step. Nothing is tessellated, so memory stays small.
// Stage 2 reads that small STEP with occt-import-js (Open Cascade as WebAssembly), builds the meshes and writes <out>.glb
// with one node per part, named like the STEP product. It needs `npm install --no-save occt-import-js`.
import fs from 'node:fs';
import path from 'node:path';

// ---- arguments -----------------------------------------------------------------------------------------------
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const flag = name => args.includes('--' + name);
const input = opt('in'), matchSrc = opt('match'), out = opt('out');
if (!input || !matchSrc || (!out && !flag('dry'))) {
  console.error('usage: node step-extract.mjs --in <file.step> --match <regex> --out <path without extension> [--dry] [--no-glb] [--deflection 0.001] [--scale 0.001]');
  process.exit(1);
}
const match = new RegExp(matchSrc);
const exclude = opt('exclude') ? new RegExp(opt('exclude')) : null;

// ---- reading the STEP as entities ----------------------------------------------------------------------------
// An entity starts on a line `#123 = ...` and ends at the line that ends with `;`. Text is read as latin1 (one byte per char).
const START = /^#(\d+)\s*=/;
function* entities(file) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.allocUnsafe(32 * 1024 * 1024);
  let rest = '', cur = null, header = [];
  try {
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n === 0) break;
      const lines = (rest + buf.latin1Slice(0, n)).split('\n');
      rest = lines.pop();
      for (const raw of lines) {
        const m = START.exec(raw);
        if (m) {
          if (cur) yield cur;
          cur = { id: +m[1], text: raw };
        } else if (cur) cur.text += raw;
        else header.push(raw);
      }
    }
    if (rest) { if (START.test(rest)) { if (cur) yield cur; cur = { id: +START.exec(rest)[1], text: rest }; } else if (cur) cur.text += rest; }
    if (cur) yield cur;
  } finally { fs.closeSync(fd); }
  entities.header = header;
}

// ---- stage 1, pass 1: index references and the structural entities --------------------------------------------
const STRUCT = new Set(['PRODUCT', 'PRODUCT_DEFINITION', 'PRODUCT_DEFINITION_FORMATION', 'PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE',
  'PRODUCT_DEFINITION_SHAPE', 'SHAPE_DEFINITION_REPRESENTATION', 'NEXT_ASSEMBLY_USAGE_OCCURRENCE',
  'CONTEXT_DEPENDENT_SHAPE_REPRESENTATION', 'SHAPE_REPRESENTATION_RELATIONSHIP', 'STYLED_ITEM']);
let refStart = new Int32Array(1 << 22), refLen = new Int32Array(1 << 22), refs = new Int32Array(1 << 24), nRefs = 0;
const grow = (a, n) => { const b = new a.constructor(Math.max(n, a.length * 2)); b.set(a); return b; };
const struct = new Map(); // id -> { type, text, refs }
const reRef = /#(\d+)/g, reType = /^\s*(?:\(\s*)?([A-Z0-9_]+)/;
console.log('reading', input);
const t0 = Date.now();
let count = 0;
for (const e of entities(input)) {
  count++;
  if (e.id >= refStart.length) { refStart = grow(refStart, e.id + 1); refLen = grow(refLen, e.id + 1); }
  const eq = e.text.indexOf('=');
  refStart[e.id] = nRefs;
  reRef.lastIndex = eq;
  let m;
  while ((m = reRef.exec(e.text))) {
    if (nRefs === refs.length) refs = grow(refs, nRefs + 1);
    refs[nRefs++] = +m[1];
  }
  refLen[e.id] = nRefs - refStart[e.id];
  const type = reType.exec(e.text.slice(eq + 1, eq + 80))?.[1];
  if (STRUCT.has(type)) struct.set(e.id, { type, text: e.text, refs: Array.from(refs.subarray(refStart[e.id], nRefs)) });
}
console.log(`${count} entities indexed in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const refsOf = id => refs.subarray(refStart[id], refStart[id] + refLen[id]);
const firstString = text => /'((?:[^']|'')*)'/.exec(text.slice(text.indexOf('(')))?.[1] ?? '';

// ---- the assembly structure -----------------------------------------------------------------------------------
const nameOfProduct = new Map(); // PRODUCT id -> name
const productOfPdf = new Map();  // formation id -> PRODUCT id
const pdOfProduct = new Map();   // PRODUCT id -> [PRODUCT_DEFINITION ids]
const productOfPd = new Map();   // PD id -> PRODUCT id
const pdsOf = new Map();         // PD id or NAUO id -> [PRODUCT_DEFINITION_SHAPE ids]
const sdrOfPds = new Map(), cdsrOfPds = new Map();
const nauos = [];                // { id, parent, child } (PD ids)
for (const [id, s] of struct) {
  if (s.type === 'PRODUCT') nameOfProduct.set(id, firstString(s.text));
  else if (s.type.startsWith('PRODUCT_DEFINITION_FORMATION')) productOfPdf.set(id, s.refs[0]);
  else if (s.type === 'PRODUCT_DEFINITION_SHAPE') (pdsOf.get(s.refs[0]) ?? pdsOf.set(s.refs[0], []).get(s.refs[0])).push(id);
  else if (s.type === 'SHAPE_DEFINITION_REPRESENTATION') (sdrOfPds.get(s.refs[0]) ?? sdrOfPds.set(s.refs[0], []).get(s.refs[0])).push(id);
  else if (s.type === 'CONTEXT_DEPENDENT_SHAPE_REPRESENTATION') (cdsrOfPds.get(s.refs[1]) ?? cdsrOfPds.set(s.refs[1], []).get(s.refs[1])).push(id);
  else if (s.type === 'NEXT_ASSEMBLY_USAGE_OCCURRENCE') nauos.push({ id, parent: s.refs[0], child: s.refs[1] });
}
for (const [id, s] of struct) if (s.type === 'PRODUCT_DEFINITION') {
  const product = productOfPdf.get(s.refs[0]);
  productOfPd.set(id, product);
  (pdOfProduct.get(product) ?? pdOfProduct.set(product, []).get(product)).push(id);
}
const nameOfPd = pd => nameOfProduct.get(productOfPd.get(pd)) ?? '?';
const childrenOf = new Map(), parentsOf = new Map();
for (const n of nauos) {
  (childrenOf.get(n.parent) ?? childrenOf.set(n.parent, []).get(n.parent)).push(n);
  (parentsOf.get(n.child) ?? parentsOf.set(n.child, []).get(n.child)).push(n);
}
const reach = (start, next) => { const seen = new Set(start), q = [...start]; while (q.length) for (const x of next(q.pop()) ?? []) if (!seen.has(x)) { seen.add(x); q.push(x); } return seen; };

// ---- what is wanted ---------------------------------------------------------------------------------------------
const matched = new Set([...productOfPd.keys()].filter(pd => match.test(nameOfPd(pd))));
if (!matched.size) { console.error(`no product name matches /${matchSrc}/`); process.exit(2); }
// If the pattern matches an assembly, only that assembly counts: a matched part used somewhere else on the bike
// (a screw named after one assembly but used in several) is left out there. With no assembly matched, every instance of a matched part counts.
const excluded = pd => exclude?.test(nameOfPd(pd));
const assemblies = new Set([...matched].filter(pd => childrenOf.has(pd) && !excluded(pd)));
const roots = assemblies.size ? assemblies : new Set([...matched].filter(pd => !excluded(pd)));
if (!roots.size) { console.error('--exclude removes everything that matched'); process.exit(2); }
const desc = reach(roots, pd => childrenOf.get(pd)?.map(n => n.child).filter(c => !excluded(c))); // the roots and everything inside them
const anc = reach(roots, pd => parentsOf.get(pd)?.map(n => n.parent));       // the roots and everything above them
// An assembly link is kept when it lies inside a matched assembly, or on the way from the root down to a matched product.
// (A part shared with an assembly that is neither inside nor above a match is not pulled in through that other assembly.)
const keepNauos = nauos.filter(n => (desc.has(n.parent) && desc.has(n.child)) || (anc.has(n.parent) && anc.has(n.child)));
const wantedPds = new Set([...desc, ...anc]);
console.log(`matched ${matched.size} product(s) /${matchSrc}/; ${assemblies.size ? `${assemblies.size} assembly(ies) used as the root, parts matched elsewhere are ignored` : 'no assembly matched, all instances of the matched parts are taken'}`);
console.log(`${desc.size} products inside the roots, ${anc.size - roots.size} above them (placement only)`);
console.log('roots:', [...roots].map(nameOfPd).sort().join(', ').slice(0, 600));

// ---- stage 1, pass 2: the entities to keep -----------------------------------------------------------------------
const keep = new Uint8Array(refStart.length);
const stack = [];
const add = id => { if (id < keep.length && !keep[id] && refLen[id] + 1) { keep[id] = 1; stack.push(id); } };
for (const pd of wantedPds) {
  add(pd);
  for (const pds of pdsOf.get(pd) ?? []) { add(pds); for (const sdr of sdrOfPds.get(pds) ?? []) add(sdr); }
}
for (const n of keepNauos) {
  add(n.id);
  for (const pds of pdsOf.get(n.id) ?? []) { add(pds); for (const c of cdsrOfPds.get(pds) ?? []) add(c); }
}
while (stack.length) { const id = stack.pop(); for (const r of refsOf(id)) add(r); }
// a part's shape representation is tied to its solid bodies by a relationship that nothing points to
for (const [id, s] of struct) if (s.type === 'SHAPE_REPRESENTATION_RELATIONSHIP' && !keep[id] && s.refs.some(r => keep[r])) add(id);
while (stack.length) { const id = stack.pop(); for (const r of refsOf(id)) add(r); }
// colours: style entries whose item is kept
for (const [id, s] of struct) if (s.type === 'STYLED_ITEM' && !keep[id] && keep[s.refs[s.refs.length - 1]]) add(id);
while (stack.length) { const id = stack.pop(); for (const r of refsOf(id)) add(r); }
let kept = 0;
for (let i = 0; i < keep.length; i++) kept += keep[i];
console.log(`keeping ${kept} of ${count} entities (${(100 * kept / count).toFixed(2)} %)`);
if (flag('dry')) process.exit(0);

fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
const ws = fs.createWriteStream(out + '.step');
ws.write(entities.header.join('\n') + '\n');
for (const e of entities(input)) if (e.id < keep.length && keep[e.id]) ws.write(e.text + '\n');
ws.write('ENDSEC;\nEND-ISO-10303-21;\n');
await new Promise(res => ws.end(res));
console.log(`${out}.step  ${(fs.statSync(out + '.step').size / 1024).toFixed(0)} KB`);
if (flag('no-glb')) process.exit(0);

// ---- stage 2: STEP -> GLB ----------------------------------------------------------------------------------------
let occtFactory;
try { occtFactory = (await import('occt-import-js')).default; } catch {
  console.error('occt-import-js is not installed. Run: npm install --no-save occt-import-js   (or use --no-glb and open the .step in FreeCAD)');
  process.exit(3);
}
const { Document, NodeIO } = await import('@gltf-transform/core');
const occt = await occtFactory();
const scale = +opt('scale', '0.001');
const res = occt.ReadStepFile(new Uint8Array(fs.readFileSync(out + '.step')), {
  linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: +opt('deflection', '0.001'), angularDeflection: +opt('angular', '0.5'),
});
if (!res.success) { console.error('occt-import-js could not read the extracted STEP'); process.exit(4); }
const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('shifter');
const materials = new Map();
let tris = 0;
for (const m of res.meshes) {
  const color = m.color ?? [0.6, 0.6, 0.6], key = color.join(',');
  if (!materials.has(key)) materials.set(key, doc.createMaterial('c' + materials.size).setBaseColorFactor([...color, 1]).setMetallicFactor(0).setRoughnessFactor(0.6));
  const pos = Float32Array.from(m.attributes.position.array, v => v * scale);
  const prim = doc.createPrimitive().setMaterial(materials.get(key))
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(m.index.array)).setBuffer(buffer));
  if (m.attributes.normal) prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(Float32Array.from(m.attributes.normal.array)).setBuffer(buffer));
  scene.addChild(doc.createNode(m.name || 'part').setMesh(doc.createMesh(m.name || 'part').addPrimitive(prim)));
  tris += m.index.array.length / 3;
}
await new NodeIO().write(out + '.glb', doc);
console.log(`${out}.glb  ${(fs.statSync(out + '.glb').size / 1024).toFixed(0)} KB, ${res.meshes.length} meshes, ${tris} triangles`);
console.log('heaviest meshes:', res.meshes.map(m => [m.name, m.index.array.length / 3]).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, t]) => `${n} ${t}`).join(', '));

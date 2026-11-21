// Prints the node tree of a glTF with triangle counts: node tree.mjs <file.gltf> [depth]
import fs from 'fs';
const g = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
console.log('asset', JSON.stringify(g.asset), 'extUsed', g.extensionsUsed, 'extReq', g.extensionsRequired);
console.log('counts nodes', g.nodes.length, 'meshes', g.meshes.length, 'materials', g.materials?.length, 'textures', g.textures?.length, 'images', g.images?.length, 'accessors', g.accessors.length, 'scenes', g.scenes.length, 'anims', g.animations?.length ?? 0);
let tris = 0; const meshTris = g.meshes.map(m => m.primitives.reduce((s,p)=> s + (p.indices!=null ? g.accessors[p.indices].count/3 : g.accessors[p.attributes.POSITION].count/3), 0));
tris = meshTris.reduce((a,b)=>a+b,0);
console.log('total tris (unique meshes)', tris);
// mesh reuse
const useCount = {}; g.nodes.forEach(n => { if (n.mesh!=null) useCount[n.mesh]=(useCount[n.mesh]||0)+1; });
let instTris = 0; for (const [m,c] of Object.entries(useCount)) instTris += meshTris[m]*c;
console.log('total tris drawn (with reuse)', instTris, 'meshes reused', Object.values(useCount).filter(c=>c>1).length);
console.log('materials:', g.materials.map(m=>m.name).join(' | '));
// hierarchy
const parent = {}; g.nodes.forEach((n,i)=> (n.children||[]).forEach(c=> parent[c]=i));
const depth = i => parent[i]==null?0:1+depth(parent[i]);
const roots = g.scenes[g.scene||0].nodes;
function walk(i, d, maxd) {
  const n = g.nodes[i];
  const t = n.mesh!=null ? Math.round(meshTris[n.mesh]) : '';
  const xf = n.matrix ? 'M' : (n.translation||n.rotation||n.scale ? 'TRS' : '');
  if (d <= maxd) console.log('  '.repeat(d) + `[${i}] ${n.name ?? '(noname)'} ${n.mesh!=null?'mesh'+n.mesh+' t'+t:''} ${xf} ${n.children?'('+n.children.length+' ch)':''}`);
  (n.children||[]).forEach(c => walk(c, d+1, maxd));
}
roots.forEach(r => walk(r, 0, +process.argv[3] || 4));

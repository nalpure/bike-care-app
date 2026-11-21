// World bounding boxes (mm, from the corners of each local box, so turned parts look larger) and materials per mesh node: node bbox.mjs <file.gltf> [name regex]
import fs from 'fs';
const g = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const mul=(a,b)=>{const r=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)r[j*4+i]+=a[k*4+i]*b[j*4+k];return r;};
const trs=n=>{if(n.matrix)return n.matrix;const [x,y,z,w]=n.rotation||[0,0,0,1];const [sx,sy,sz]=n.scale||[1,1,1];const [tx,ty,tz]=n.translation||[0,0,0];
return [(1-2*(y*y+z*z))*sx,(2*(x*y+z*w))*sx,(2*(x*z-y*w))*sx,0,(2*(x*y-z*w))*sy,(1-2*(x*x+z*z))*sy,(2*(y*z+x*w))*sy,0,(2*(x*z+y*w))*sz,(2*(y*z-x*w))*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1];};
const world={};const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const visit=(i,p)=>{world[i]=mul(p,trs(g.nodes[i]));(g.nodes[i].children||[]).forEach(c=>visit(c,world[i]));};
g.scenes[0].nodes.forEach(r=>visit(r,I));
const ap=(m,v)=>[0,1,2].map(i=>m[i]*v[0]+m[4+i]*v[1]+m[8+i]*v[2]+m[12+i]);
const f=v=>v.map(x=>(x*1000).toFixed(0)).join(',');
const filter = process.argv[3] ? new RegExp(process.argv[3]) : null;
g.nodes.forEach((n,i)=>{ if(n.mesh==null) { if(filter && filter.test(n.name)) console.log(`${n.name} EMPTY children=${JSON.stringify(n.children)} extras=${JSON.stringify(n.extras)}`); return;} if(filter && !filter.test(n.name)) return;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
  const prims=g.meshes[n.mesh].primitives;
  for(const p of prims){const a=g.accessors[p.attributes.POSITION];
    for(const cx of [a.min[0],a.max[0]])for(const cy of [a.min[1],a.max[1]])for(const cz of [a.min[2],a.max[2]]){const w=ap(world[i],[cx,cy,cz]);for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],w[k]);mx[k]=Math.max(mx[k],w[k]);}}}
  const mats=prims.map(p=>(g.materials[p.material]?.name||'-')+(g.materials[p.material]?.pbrMetallicRoughness?.baseColorTexture?'[tex]':'')+'/'+Math.round((p.indices!=null?g.accessors[p.indices].count:0)/3));
  console.log(`${n.name.slice(0,40).padEnd(40)} min(${f(mn)}) max(${f(mx)}) size(${f(mx.map((v,k)=>v-mn[k]))}) prims:${mats.join(' ')}`);
});

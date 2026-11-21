// Connected pieces ("islands") per mesh and material, with their size in mm: node islands.mjs <file.gltf> <name regex>
import fs from 'fs'; import path from 'path';
const file=process.argv[2]; const g=JSON.parse(fs.readFileSync(file,'utf8'));
const bin=fs.readFileSync(path.join(path.dirname(file), g.buffers[0].uri));
const re=new RegExp(process.argv[3]);
const read=(ai)=>{const a=g.accessors[ai];const bv=g.bufferViews[a.bufferView];const off=(bv.byteOffset||0)+(a.byteOffset||0);
 const n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];const T={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array}[a.componentType];
 const stride=bv.byteStride||n*T.BYTES_PER_ELEMENT;const out=new Array(a.count*n);
 const dv=new DataView(bin.buffer,bin.byteOffset);
 for(let i=0;i<a.count;i++)for(let k=0;k<n;k++){const o=off+i*stride+k*T.BYTES_PER_ELEMENT;out[i*n+k]= T===Float32Array?dv.getFloat32(o,true):T===Uint32Array?dv.getUint32(o,true):T===Uint16Array?dv.getUint16(o,true):dv.getUint8(o);}return out;};
g.nodes.forEach(n=>{ if(n.mesh==null||!re.test(n.name))return;
 const res=[];
 for(const p of g.meshes[n.mesh].primitives){const pos=read(p.attributes.POSITION);const idx=read(p.indices);
  // weld by position (CAD exports split normals)
  const key=i=>pos.slice(i*3,i*3+3).map(v=>Math.round(v*1e5)).join(',');const id={};const rep=[];
  for(let i=0;i<pos.length/3;i++){const k=key(i);if(id[k]==null)id[k]=i;rep[i]=id[k];}
  const par=rep.map((_,i)=>i);const f=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;};
  for(let t=0;t<idx.length;t+=3){const a=f(rep[idx[t]]),b=f(rep[idx[t+1]]),c=f(rep[idx[t+2]]);par[b]=a;par[f(c)]=a;}
  const comps={};for(let t=0;t<idx.length;t+=3){const r=f(rep[idx[t]]);(comps[r]??={tris:0,mn:[1e9,1e9,1e9],mx:[-1e9,-1e9,-1e9]}).tris++;for(const v of [idx[t],idx[t+1],idx[t+2]])for(let k=0;k<3;k++){comps[r].mn[k]=Math.min(comps[r].mn[k],pos[v*3+k]);comps[r].mx[k]=Math.max(comps[r].mx[k],pos[v*3+k]);}}
  const list=Object.values(comps).sort((a,b)=>b.tris-a.tris);
  res.push(`${g.materials[p.material]?.name}: ${list.length} islands: `+list.slice(0,12).map(c=>`${c.tris}t[${c.mx.map((v,k)=>((v-c.mn[k])*1000).toFixed(0)).join('x')}]`).join(' '));
 }
 console.log(n.name.slice(0,40)+'\n   '+res.join('\n   '));
});

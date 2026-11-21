// Renders pages of this folder in headless Chromium (swiftshader) and saves PNGs.
// node tools/assets/explore/shot.mjs <repo> <this folder> <out dir> "name~view.html?only=<regex>&color=1&dir=x,y,z&dist=1.4" ...
// view.html: parts matching `only` (three.js names: spaces become _, dots are dropped), coloured per part with a legend when color=1.
// simplify.html: the same, simplified to `ratio` with meshoptimizer, with the triangle count. Both take file=<path from repo root>.
import http from 'http'; import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
const [repo, viewDir, outDir, ...jobs] = process.argv.slice(2);
const types={'.js':'text/javascript','.html':'text/html','.gltf':'model/gltf+json','.bin':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg'};
const srv=http.createServer((q,s)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=u.startsWith('/repo/')?path.join(repo,u.slice(6)):path.join(viewDir,u==='/'?'view.html':u);
 fs.readFile(f,(e,b)=>{if(e){s.writeHead(404);s.end();return;}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});s.end(b);});}).listen(0);
const { chromium } = await import(pathToFileURL(path.join(repo,'node_modules/playwright/index.mjs')).href); const port=srv.address().port; const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}); const p=await b.newPage({viewport:{width:900,height:700}});
p.on('console',m=>console.log('console:',m.text())); p.on('pageerror',e=>console.log('err',e.message));
for(const j of jobs){const [name,qs]=j.split('~'); await p.goto(`http://localhost:${port}/${qs}`); await p.waitForFunction('window.done',null,{timeout:120000}); await p.screenshot({path:path.join(outDir,name+'.png')}); console.log('shot',name);}
await b.close(); srv.close();

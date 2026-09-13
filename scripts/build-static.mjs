import { mkdir, readdir, rm, copyFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = process.cwd();
const out = join(root, 'dist');
const allowedExt = new Set(['.html','.css','.js','.xml','.txt','.webmanifest','.png','.jpg','.jpeg','.webp','.svg','.ico']);
const allowedNames = new Set(['_headers','_redirects','slug-registry.json']);
const blocked = new Set(['worker.js']);

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

for(const entry of await readdir(root,{withFileTypes:true})){
  if(!entry.isFile()) continue;
  const name=entry.name;
  if(blocked.has(name)) continue;
  if(!allowedNames.has(name) && !allowedExt.has(extname(name).toLowerCase())) continue;
  await copyFile(join(root,name),join(out,name));
}

console.log('Built static asset directory:', out);

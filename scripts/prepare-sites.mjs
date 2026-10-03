import {mkdir,copyFile,readFile,rm} from 'node:fs/promises';
const manifest=JSON.parse(await readFile('.openai/hosting.json','utf8'));
if(manifest.static)throw new Error('This Sites project uses a server gateway.');
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});
await copyFile('sites/gateway.js','dist/server/index.js');
console.log('Independent wedding Sites gateway ready. Cloudflare owns authentication and data.');

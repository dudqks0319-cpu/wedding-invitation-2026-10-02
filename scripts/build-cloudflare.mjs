import {spawnSync} from 'node:child_process';
import {cp,mkdir} from 'node:fs/promises';
const vite=process.platform==='win32'?'node_modules/.bin/vite.cmd':'node_modules/.bin/vite';
for(const config of ['preview/vite.config.mts','cloudflare/vite.config.mts']){
 const result=spawnSync(vite,['build','--config',config],{stdio:'inherit',env:{...process.env,WEDDING_BUILD_MODE:'remote'}});
 if(result.status!==0)process.exit(result.status??1);
}
for(const folder of ['photos','samples','app-intro']){await mkdir(`dist-cloudflare/${folder}`,{recursive:true});await cp(`public/${folder}`,`dist-cloudflare/${folder}`,{recursive:true});}
console.log('Cloudflare frontend and Worker module built. No deployment performed.');

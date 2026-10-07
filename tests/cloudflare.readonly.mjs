// Explicit read-only production check; no accounts, uploads, publication or provider exchanges.
import {writeFile,mkdir} from 'node:fs/promises';
const origin='https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site',checks=[];
const targets=[['/api/v2/health',200,'GET'],['/api/v2/auth/session',401,'GET'],['/api/v2/invitations',401,'GET'],['/api/v2/invitations/no-such-audit-20261007',404,'GET'],['/api/photos/00000000-0000-0000-0000-000000000000',404,'GET'],['/photos/wedding-blossom-v2.webp',200,'HEAD'],['/photos/wedding-classic-v2.webp',200,'HEAD']];
for(const [path,expected,method] of targets){const r=await fetch(origin+path,{method,signal:AbortSignal.timeout(20000)});checks.push({path,method,status:r.status,expected,result:r.status===expected?'PASS':'FAIL',type:r.headers.get('content-type')});}
const r=await fetch('https://osamosam-api.dudqks0319.workers.dev/api/v2/health',{signal:AbortSignal.timeout(20000)});checks.push({path:'direct Worker origin',status:r.status,expected:403,result:r.status===403?'PASS':'FAIL'});
const folder=process.env.WEDDING_EVIDENCE_DIR??'docs/evidence/backend-audit-20261007';await mkdir(folder,{recursive:true});
await writeFile(folder+'/production-read-only.json',JSON.stringify({date:new Date().toISOString(),lane:'Public anonymous HTTP and direct-origin denial; no fixtures, provider transforms or existing data edits',checks},null,2)+'\n');
for(const c of checks)console.log(c.result,c.path,c.status);if(checks.some(c=>c.result!=='PASS'))process.exitCode=1;

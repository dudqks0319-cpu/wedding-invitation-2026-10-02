import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=process.cwd(),toolchain=process.env.OSAM_TOOLCHAIN??path.resolve(root,'../osam-rebuild/node_modules');
const {build}=createRequire(pathToFileURL(path.join(toolchain,'placeholder.cjs')))('esbuild');
const source=await readFile('cloudflare/osam-worker.template.ts','utf8');
const output=path.join(root,'cloudflare/build/gateway-fixture.mjs');
await build({stdin:{contents:source,resolveDir:path.join(root,'cloudflare'),loader:'ts'},outfile:output,bundle:true,format:'esm',platform:'browser',plugins:[{name:'fixture-only-legacy',setup(b){
 b.onResolve({filter:/\.open-next\/worker\.js$/},()=>({path:'legacy',namespace:'fixture'}));
 b.onResolve({filter:/server\/cloudflare\/cleanup$/},()=>({path:'cleanup',namespace:'fixture'}));
 b.onResolve({filter:/server\/cloudflare\/gateway$/},()=>({path:path.resolve(toolchain,'../src/server/cloudflare/gateway.ts')}));
 b.onResolve({filter:/replacement\.mjs$/},()=>({path:path.join(root,'cloudflare/build/replacement.mjs')}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='legacy'?"export default {fetch:async()=>new Response('legacy-only')};":"export async function cleanup(){}",loader:'js'}));
 }}]});
const {default:worker}=await import(pathToFileURL(output));
const {default:gateway}=await import('../sites/gateway.js');
const origin='https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site',upstream='https://osamosam-api.dudqks0319.workers.dev';
const old='old-gateway-fixture-secret-never-used-remotely',fresh='new-gateway-fixture-secret-never-used-remotely',checks=[];
const env={OSAMOSAM_GATEWAY_SECRET:old,WEDDING_GATEWAY_SECRET:fresh,NEXT_PUBLIC_SITE_URL:'https://osamosam-app.jyb1126.chatgpt.site',ABUSE_HMAC_SECRET:'test-abuse-key-never-used-remotely-1234567890',DB:{prepare(){return {bind(){return this;},async first(){return {enabled:1};}}}},ASSETS:{fetch:async()=>new Response('<title>fixture</title></head>')} };
async function signed(path,secret=fresh,options={}){
 const method=options.method??'GET',timestamp=options.timestamp??String(Date.now()),ip='192.0.2.9';
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sign=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode([method,path,ip,timestamp].join('\n')))).toString('hex');
 return new Request(upstream+(options.actualPath??path),{method,headers:{'x-osam-client-ip':ip,'x-osam-proxy-time':timestamp,'x-osam-proxy-signature':sign,'x-forwarded-host':'evil.example',Origin:options.origin??origin,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},...(method==='POST'?{body:JSON.stringify({provider:'google',next:'/my'})}:{})});
}
async function check(name,fn){await fn();checks.push({name,result:'PASS'});console.log('PASS',name);}
await check('unsigned v2 APIs, pages and media cannot bypass the Site',async()=>{
 for(const path of ['/api/v2/health','/api/v2/invitations','/api/photos/00000000-0000-0000-0000-000000000000','/i/test-draft','/templates/blossom','/photos/wedding-blossom-v2.webp','/'])assert.equal((await worker.fetch(new Request(upstream+path),env,{})).status,403);
});
await check('unsigned legacy native endpoints keep their existing contract',async()=>assert.equal(await (await worker.fetch(new Request(upstream+'/auth/native/redeem'),env,{})).text(),'legacy-only'));
await check('separate Site signature reaches real v2 health',async()=>assert.equal((await worker.fetch(await signed('/api/v2/health'),env,{})).status,200));
await check('new Site enforces new origin CSRF',async()=>{assert.equal((await worker.fetch(await signed('/api/v2/auth/start',fresh,{method:'POST'}),env,{})).status,200);assert.equal((await worker.fetch(await signed('/api/v2/auth/start',fresh,{method:'POST',origin:env.NEXT_PUBLIC_SITE_URL}),env,{})).status,403);});
await check('old Site cannot assert the new origin',async()=>assert.equal((await worker.fetch(await signed('/api/v2/auth/start',old,{method:'POST'}),env,{})).status,403));
await check('new Site origin is fixed despite forged forwarded host',async()=>assert.ok((await (await worker.fetch(await signed('/templates/blossom'),env,{})).text()).includes(origin+'/templates/blossom')));
await check('expired signatures and path tampering fail closed',async()=>{assert.equal((await worker.fetch(await signed('/api/v2/health',fresh,{timestamp:String(Date.now()-60000)}),env,{})).status,403);assert.equal((await worker.fetch(await signed('/api/v2/health',fresh,{actualPath:'/api/v2/auth/session'}),env,{})).status,403);});
await check('old native routes stay old; new Site exposes only replacement routes',async()=>{assert.equal(await (await worker.fetch(await signed('/auth/native/redeem',old),env,{})).text(),'legacy-only');assert.equal((await worker.fetch(await signed('/auth/native/redeem'),env,{})).status,404);});
await check('gateway without server secret fails closed',async()=>assert.equal((await gateway.fetch(new Request(origin),{})).status,503));
const originalFetch=globalThis.fetch;
try{
 await check('gateway strips caller identity/proxy headers and preserves host cookie',async()=>{
  globalThis.fetch=async req=>{assert.equal(new URL(req.url).origin,upstream);assert.equal(req.headers.get('oai-authenticated-user-id'),null);assert.equal(req.headers.get('x-osam-proxy-signature').length,64);return new Response(null,{status:303,headers:{Location:upstream+'/my','Set-Cookie':'__Host-osam-session=fixture; Secure; HttpOnly; Path=/','x-osam-private':'hidden'}});};
  const res=await gateway.fetch(new Request(origin+'/templates/blossom',{headers:{'cf-connecting-ip':'192.0.2.9','oai-authenticated-user-id':'forged','x-osam-proxy-signature':'forged'}}),{WEDDING_GATEWAY_SECRET:fresh});assert.equal(res.headers.get('Location'),origin+'/my');assert.ok(res.headers.get('set-cookie').includes('__Host-osam-session'));assert.equal(res.headers.get('x-osam-private'),null);
 });
 await check('gateway retains provider destination',async()=>{globalThis.fetch=async()=>new Response(null,{status:303,headers:{Location:'https://accounts.google.com/o/oauth2/v2/auth'}});assert.equal((await gateway.fetch(new Request(origin,{headers:{'cf-connecting-ip':'192.0.2.9'}}),{WEDDING_GATEWAY_SECRET:fresh})).headers.get('Location'),'https://accounts.google.com/o/oauth2/v2/auth');});
 await check('upstream outage is controlled and contains no details',async()=>{globalThis.fetch=async()=>{throw new Error('private fixture secret');};const res=await gateway.fetch(new Request(origin,{headers:{'cf-connecting-ip':'192.0.2.9'}}),{WEDDING_GATEWAY_SECRET:fresh});assert.equal(res.status,503);assert.ok(!(await res.text()).includes('private fixture secret'));});
}finally{globalThis.fetch=originalFetch;}
await writeFile(process.env.WEDDING_EVIDENCE_DIR?path.join(process.env.WEDDING_EVIDENCE_DIR,'independent-gateway-local.json'):'docs/evidence/independent-gateway-local-20261003.json',JSON.stringify({time:new Date().toISOString(),lane:'Actual worker template and application, isolated legacy handler; mocked fetch for Sites gateway',checks},null,2)+'\n');console.log(checks.length+' gateway checks passed');

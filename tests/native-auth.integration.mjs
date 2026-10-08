import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=process.cwd(),toolchain=path.resolve(root,'../osam-rebuild/node_modules');
const {Miniflare,convertV4MiniflareOptions}=await import(pathToFileURL(path.join(toolchain,'miniflare/dist/src/index.js')).href);
const {default:worker,weddingBridgeRequest,weddingBridgeReturn,weddingOrigin}=await import('../cloudflare/build/replacement.mjs');
const origin=weddingOrigin(),legacy='https://osamosam-app.jyb1126.chatgpt.site',checks=[];
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:path.join(root,'cloudflare/build/replacement.mjs'),compatibilityDate:'2026-09-29',d1Databases:{DB:'native-fixture'},r2Buckets:['MEDIA']}));
const db=await mf.getD1Database('DB');
const env={DB:db,MEDIA:await mf.getR2Bucket('MEDIA'),NEXT_PUBLIC_SITE_URL:origin,ABUSE_HMAC_SECRET:'local-test-hmac-never-used-on-production-123456789'};
const digest=s=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(b=>Buffer.from(b).toString('hex'));
const challenge=s=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(b=>Buffer.from(b).toString('base64url'));
const get=url=>new Request(url,{headers:{'cf-connecting-ip':'192.0.2.50'}});
const verifier='a'.repeat(64),state='b'.repeat(64),user=crypto.randomUUID();
const q={provider:'google',challenge:await challenge(verifier),state};
const start=params=>worker.fetch(get(origin+'/api/v2/auth/native/start?'+new URLSearchParams(params)),env);
async function ticket(extra={}){const code=crypto.randomUUID().replaceAll('-','')+'0123456789abcdef';await db.prepare('INSERT INTO native_auth_tickets VALUES(?,?,?,?,?)').bind(await digest(code),user,extra.challenge??q.challenge,extra.state??state,extra.expires??new Date(Date.now()+60000).toISOString()).run();return code;}
const redeem=(code,extra={},from=origin)=>worker.fetch(new Request(origin+'/api/v2/auth/native/redeem',{method:'POST',headers:{Origin:from,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'cf-connecting-ip':'192.0.2.50'},body:JSON.stringify({code,verifier,state,next:'/my',...extra})}),env);
const exists=async code=>!!await db.prepare('SELECT code_hash FROM native_auth_tickets WHERE code_hash=?').bind(await digest(code)).first();
async function check(name,fn){await db.prepare('DELETE FROM w2_limits').run();await fn();checks.push({name,result:'PASS'});console.log('PASS',name);}
try{
 await db.exec('CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,created_at TEXT);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,created_at TEXT,expires_at TEXT);CREATE TABLE deletion_jobs(id TEXT PRIMARY KEY,owner_id TEXT,state TEXT);CREATE TABLE native_auth_tickets(code_hash TEXT PRIMARY KEY,user_id TEXT,challenge TEXT,state TEXT,expires_at TEXT);');
 for(const sql of (await readFile('cloudflare/migrations/0005_replacement.sql','utf8')).replace(/^--.*$/gm,'').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
 for(const sql of (await readFile('cloudflare/migrations/0006_service_accounts.sql','utf8')).replace(/^--.*$/gm,'').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
 for(const sql of (await readFile('cloudflare/migrations/0007_operator_review.sql','utf8')).replace(/^--.*$/gm,'').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
 for(const sql of (await readFile('cloudflare/migrations/0008_billing_ledger.sql','utf8')).replace(/^--.*$/gm,'').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
 await db.prepare('INSERT INTO users VALUES(?,NULL,?)').bind(user,new Date().toISOString()).run();
 await check('native start retains registered provider and sends no verifier',async()=>{const r=await start(q);assert.equal(r.status,303);const u=new URL(r.headers.get('Location'));assert.equal(u.origin,legacy);assert.equal(u.pathname,'/auth/wedding/google');assert.equal(u.searchParams.get('native'),'1');assert.ok(!u.href.includes(verifier));});
 await check('native start rejects provider, challenge, state and extra query',async()=>{for(const p of [{...q,provider:'naver'},{...q,challenge:'bad'},{...q,state:'bad'},{...q,redirect:'https://evil.test'}])assert.equal((await start(p)).status,400);const r=await worker.fetch(get(origin+'/api/v2/auth/native/start?'+new URLSearchParams(q)+'&state='+state),env);assert.equal(r.status,400);});
 await check('legacy bridge isolates native mode and rejects duplicate mode',async()=>{const url=legacy+'/auth/wedding/google?'+new URLSearchParams({challenge:q.challenge,state,native:'1'});const r=weddingBridgeRequest(get(url));assert.equal(r.status,303);assert.match(r.headers.get('Set-Cookie'),/^__Host-w2-bridge=native\./);assert.equal(weddingBridgeRequest(get(url+'&native=1')).status,400);});
 await check('native callback uses app-specific scheme while ordinary native callback stays unchanged',async()=>{const code=await ticket(),loc='com.invitehub.app://auth?'+new URLSearchParams({code,state}),r=new Response(null,{status:302,headers:{Location:loc}}),req=new Request(legacy+'/auth/google/callback',{headers:{Cookie:'__Host-w2-bridge=native.'+state}});assert.equal(new URL(weddingBridgeReturn(req,r).headers.get('Location')).protocol,'com.invitehub.wedding-preview:');assert.equal(weddingBridgeReturn(get(legacy+'/auth/google/callback'),r),r);});
 await check('foreign origin cannot redeem ticket',async()=>{const code=await ticket();assert.equal((await redeem(code,{},'https://evil.test')).status,403);assert.ok(await exists(code));});
 await check('wrong verifier and state preserve ticket',async()=>{const code=await ticket();assert.equal((await redeem(code,{verifier:'c'.repeat(64)})).status,401);assert.equal((await redeem(code,{state:'c'.repeat(64)})).status,401);assert.ok(await exists(code));});
 await check('malformed payload rejects before consumption',async()=>{const code=await ticket();for(const bad of [{code:'bad'},{verifier:'bad'},{redirect:'https://evil.test'}])assert.equal((await redeem(code,bad)).status,400);assert.ok(await exists(code));});
 await check('valid native ticket establishes same-origin HttpOnly session and owner identity',async()=>{const code=await ticket(),r=await redeem(code);assert.equal(r.status,303);assert.equal(r.headers.get('Location'),origin+'/my');assert.match(r.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Lax/);const c=r.headers.get('Set-Cookie').split(';')[0];const actor=await worker.fetch(new Request(origin+'/api/v2/auth/session',{headers:{Cookie:c,'cf-connecting-ip':'192.0.2.50'}}),env);assert.equal((await actor.json()).id,user);assert.equal(await exists(code),false);assert.equal((await redeem(code)).status,401);});
 await check('expired and deleting-account tickets do not create sessions',async()=>{assert.equal((await redeem(await ticket({expires:new Date(Date.now()-1000).toISOString()}))).status,401);const code=await ticket();await db.prepare('INSERT INTO deletion_jobs VALUES(?,?,?)').bind(crypto.randomUUID(),user,'pending').run();assert.equal((await redeem(code)).status,401);await db.prepare('DELETE FROM deletion_jobs').run();});
 await check('native post-login destination stays on wedding origin',async()=>{const r=await redeem(await ticket(),{next:'//evil.test'});assert.equal(r.headers.get('Location'),origin+'/my');});
 await check('legacy host cannot use new native endpoint',async()=>{const r=await worker.fetch(get(legacy+'/api/v2/auth/native/start?'+new URLSearchParams(q)),{...env,NEXT_PUBLIC_SITE_URL:legacy});assert.equal(r.status,401);});
 await check('native auth burst enforces per-IP request limit',async()=>{for(let n=0;n<12;n++)assert.equal((await start(q)).status,303);assert.equal((await start(q)).status,429);});
 await check('API kill switch also disables native login',async()=>{await db.prepare("UPDATE w2_controls SET enabled=0 WHERE name='api'").run();assert.equal((await start(q)).status,503);assert.equal((await redeem(await ticket())).status,503);});
 await writeFile(process.env.WEDDING_EVIDENCE_DIR?path.join(process.env.WEDDING_EVIDENCE_DIR,'native-auth-local.json'):'ios/artifacts/native-auth-local.json',JSON.stringify({time:new Date().toISOString(),lane:'local Miniflare/D1 synthetic tickets; no real provider OAuth',checks},null,2)+'\n');console.log(checks.length+' native auth checks passed');
}finally{await mf.dispose();}

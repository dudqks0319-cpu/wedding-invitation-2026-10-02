import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=process.cwd(),toolchain=process.env.OSAM_TOOLCHAIN??path.resolve(root,'../osam-rebuild/node_modules');
const {Miniflare,convertV4MiniflareOptions}=await import(pathToFileURL(path.join(toolchain,'miniflare/dist/src/index.js')).href);
const {default:worker,weddingBridgeRequest,weddingBridgeReturn,weddingOrigin}=await import('../cloudflare/build/replacement.mjs');
const origin=weddingOrigin();
const legacy='https://osamosam-app.jyb1126.chatgpt.site',checks=[];
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:path.join(root,'cloudflare/build/replacement.mjs'),compatibilityDate:'2026-09-29',d1Databases:{DB:'bridge-fixture'},r2Buckets:['MEDIA']}));
const db=await mf.getD1Database('DB');
const env={DB:db,MEDIA:await mf.getR2Bucket('MEDIA'),NEXT_PUBLIC_SITE_URL:origin,ABUSE_HMAC_SECRET:'local-test-hmac-never-used-on-production-123456789'};
const digest=s=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(b=>Buffer.from(b).toString('hex'));
const pkce=s=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(b=>Buffer.from(b).toString('base64url'));
const cookie=r=>r.headers.getSetCookie().find(s=>s.startsWith('__Host-w2-login=')).split(';')[0];
const get=(url,c='')=>new Request(url,{headers:{cookie:c,'cf-connecting-ip':'192.0.2.5'}});
async function start(body={provider:'google',next:'/my'},from=origin){return worker.fetch(new Request(origin+'/api/v2/auth/start',{method:'POST',headers:{Origin:from,'Idempotency-Key':crypto.randomUUID(),'Content-Type':'application/json','cf-connecting-ip':'192.0.2.5'},body:JSON.stringify(body)}),env);}
async function check(name,fn){await fn();checks.push({name,result:'PASS'});console.log('PASS',name);}
const user=crypto.randomUUID();
let flow,c,code;
async function ticket(overrides={}){
 const token=crypto.randomUUID().replaceAll('-','')+'0123456789abcdef';
 await db.prepare('INSERT INTO native_auth_tickets VALUES(?,?,?,?,?)').bind(await digest(token),user,overrides.challenge??await pkce(flow.verifier),overrides.state??flow.state,overrides.expires??new Date(Date.now()+60000).toISOString()).run();return token;
}
const complete=(token,cookieValue=c,state=flow.state)=>worker.fetch(get(origin+'/api/v2/auth/complete?'+new URLSearchParams({code:token,state}),cookieValue),env);
try{
 await db.exec('CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,created_at TEXT);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,created_at TEXT,expires_at TEXT);CREATE TABLE deletion_jobs(id TEXT PRIMARY KEY,owner_id TEXT,state TEXT);CREATE TABLE native_auth_tickets(code_hash TEXT PRIMARY KEY,user_id TEXT,challenge TEXT,state TEXT,expires_at TEXT);');
 for(const sql of (await readFile('cloudflare/migrations/0005_replacement.sql','utf8')).replace(/^--.*$/gm,'').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
 await db.prepare('INSERT INTO users VALUES(?,NULL,?)').bind(user,new Date().toISOString()).run();
 await check('new origin rejects foreign login start',async()=>assert.equal((await start(undefined,legacy)).status,403));
 await check('provider and next are validated',async()=>{assert.equal((await start({provider:'naver'})).status,400);});
 await check('start binds verifier to HttpOnly host cookie, URL carries only challenge',async()=>{const res=await start();assert.equal(res.status,200);c=cookie(res);flow=JSON.parse(decodeURIComponent(c.slice(c.indexOf('=')+1)));const url=new URL((await res.json()).url);assert.equal(url.origin,legacy);assert.equal(url.pathname,'/auth/wedding/google');assert.equal(url.searchParams.get('challenge'),await pkce(flow.verifier));assert.ok(!url.href.includes(flow.verifier));assert.match(res.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);});
 await check('old bridge validates duplicate and malformed query',async()=>{assert.equal(weddingBridgeRequest(get(legacy+'/auth/wedding/google?challenge=x&state=y')).status,400);const q=new URLSearchParams({challenge:await pkce(flow.verifier),state:flow.state});q.append('state',flow.state);assert.equal(weddingBridgeRequest(get(legacy+'/auth/wedding/google?'+q)).status,400);});
 await check('bridge retains registered provider callback and native challenge',async()=>{const res=weddingBridgeRequest(get(legacy+'/auth/wedding/google?'+new URLSearchParams({challenge:await pkce(flow.verifier),state:flow.state})));const url=new URL(res.headers.get('Location'));assert.equal(url.origin,legacy);assert.equal(url.pathname,'/auth/google');assert.equal(url.searchParams.get('native_challenge'),await pkce(flow.verifier));assert.match(res.headers.get('set-cookie'),/^__Host-w2-bridge=/);});
 code=await ticket();
 const callback=get(legacy+'/auth/google/callback','__Host-w2-bridge='+flow.state),native=new Response(null,{status:302,headers:{Location:'com.invitehub.app://auth?'+new URLSearchParams({code,state:flow.state})}});
 await check('only matching web flow converts native redirect',async()=>{const res=weddingBridgeReturn(callback,native);assert.equal(new URL(res.headers.get('Location')).origin,origin);assert.equal(res.headers.get('Referrer-Policy'),'no-referrer');assert.equal(weddingBridgeReturn(get(legacy+'/auth/google/callback'),native),native);assert.equal(weddingBridgeReturn(get(legacy+'/auth/google/callback','__Host-w2-bridge='+'a'.repeat(64)),native),native);});
 await check('failed provider returns to independent login',async()=>{const res=weddingBridgeReturn(callback,new Response(null,{status:302,headers:{Location:legacy+'/login?expired=1'}}));assert.equal(res.headers.get('Location'),origin+'/login?expired=1');});
 await check('missing cookie does not consume ticket',async()=>{assert.equal((await complete(code,'')).headers.get('Location'),origin+'/login?expired=1');assert.ok(await db.prepare('SELECT code_hash FROM native_auth_tickets WHERE code_hash=?').bind(await digest(code)).first());});
 await check('wrong verifier and wrong state cannot consume ticket',async()=>{const wrong='__Host-w2-login='+encodeURIComponent(JSON.stringify({...flow,verifier:'f'.repeat(64)}));assert.equal((await complete(code,wrong)).headers.get('Location'),origin+'/login?expired=1');assert.equal((await complete(code,c,'b'.repeat(64))).headers.get('Location'),origin+'/login?expired=1');assert.ok(await db.prepare('SELECT code_hash FROM native_auth_tickets WHERE code_hash=?').bind(await digest(code)).first());});
 await check('duplicate query rejects without consuming',async()=>{const res=await worker.fetch(get(origin+'/api/v2/auth/complete?'+new URLSearchParams({code,state:flow.state})+'&code='+code,c),env);assert.equal(res.headers.get('Location'),origin+'/login?expired=1');});
 let session;
 await check('valid ticket issues separate host session for authenticated owner',async()=>{const res=await complete(code);assert.equal(res.headers.get('Location'),origin+'/my');session=res.headers.getSetCookie().find(s=>s.startsWith('__Host-osam-session=')).split(';')[0];assert.match(session,/=[a-f0-9]{48}$/);const actor=await worker.fetch(get(origin+'/api/v2/auth/session',session),env);assert.equal((await actor.json()).id,user);});
 await check('ticket replay cannot create another session',async()=>{const before=(await db.prepare('SELECT COUNT(*) AS n FROM sessions').first()).n;assert.equal((await complete(code)).headers.get('Location'),origin+'/login?expired=1');assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM sessions').first()).n,before);});
 await check('expired ticket fails',async()=>assert.equal((await complete(await ticket({expires:new Date(Date.now()-1000).toISOString()}))).headers.get('Location'),origin+'/login?expired=1'));
 await check('pending account deletion rejects bridge login',async()=>{const token=await ticket();await db.prepare('INSERT INTO deletion_jobs VALUES(?,?,?)').bind(crypto.randomUUID(),user,'pending').run();assert.equal((await complete(token)).headers.get('Location'),origin+'/login?expired=1');await db.prepare('DELETE FROM deletion_jobs').run();});
 await check('redirect target cannot escape wedding origin',async()=>{const token=await ticket(),crafted='__Host-w2-login='+encodeURIComponent(JSON.stringify({...flow,next:'//evil.example'}));const res=await complete(token,crafted);assert.equal(new URL(res.headers.get('Location')).origin,origin);});
 await check('new-origin logout revokes only its session',async()=>{const res=await worker.fetch(new Request(origin+'/api/v2/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:session,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),'cf-connecting-ip':'192.0.2.5'},body:'{}'}),env);assert.equal(res.status,200);assert.equal((await worker.fetch(get(origin+'/api/v2/auth/session',session),env)).status,401);});
 await writeFile('docs/evidence/independent-auth-local-20261003.json',JSON.stringify({time:new Date().toISOString(),lane:'Miniflare D1; synthetic one-use native tickets; no real provider exchange',checks},null,2)+'\n');console.log(checks.length+' auth bridge checks passed');
}finally{await mf.dispose();}

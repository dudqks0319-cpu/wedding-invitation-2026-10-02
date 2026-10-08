import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=process.cwd(),toolchain=path.resolve(root,'../osam-rebuild/node_modules');
const {Miniflare,convertV4MiniflareOptions}=await import(pathToFileURL(path.join(toolchain,'miniflare/dist/src/index.js')).href);
const {default:worker,cleanup,verifyAppleIdentity}=await import('../cloudflare/build/replacement.mjs');
const origin='https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site';
const mf=new Miniflare(convertV4MiniflareOptions({name:'store-release-fixture',modules:true,scriptPath:path.join(root,'cloudflare/build/replacement.mjs'),compatibilityDate:'2026-09-29',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'isolated-release-db'},r2Buckets:['MEDIA']}));
const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('MEDIA');
const env={DB:db,MEDIA:bucket,ABUSE_HMAC_SECRET:'synthetic-local-only-hmac-secret-32bytes',NEXT_PUBLIC_SITE_URL:origin,ASSETS:{fetch:async()=>new Response('<title>fixture</title>',{headers:{'Content-Type':'text/html'}})}};
const digest=async(s)=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
const checks=[],owners=[crypto.randomUUID(),crypto.randomUUID()],tokens=[crypto.randomUUID().replaceAll('-','')+'0123456789abcdef',crypto.randomUUID().replaceAll('-','')+'0123456789abcdef'];
let seq=0;
async function request(p,method='GET',body,who=-1,options={}){
 const headers={'cf-connecting-ip':options.ip??`192.0.2.${++seq%240+1}`,...(who>=0?{cookie:`__Host-osam-session=${tokens[who]}`}:{})};
 if(!['GET','HEAD'].includes(method))Object.assign(headers,{'Content-Type':'application/json',Origin:origin,'Idempotency-Key':options.key??crypto.randomUUID()});
 Object.assign(headers,options.headers??{});
 const res=await worker.fetch(new Request(origin+p,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
 return {status:res.status,data:res.headers.get('Content-Type')?.includes('json')?await res.json():await res.text(),headers:res.headers};
}
async function check(name,fn){await fn();checks.push({name,result:'PASS'});console.log('PASS',name);}
async function afterFirstRead(prefix,mutate,run){
 let fired=false;
 env.DB={batch:queries=>db.batch(queries),prepare(sql){
  const statement=db.prepare(sql);if(!sql.startsWith(prefix))return statement;
  return {bind(...bindings){const bound=statement.bind(...bindings);return {async first(...args){const value=await bound.first(...args);if(!fired){fired=true;await mutate(bindings);}return value;}};}};
 }};
 try{await run();assert.ok(fired,'fixture must insert the concurrent block after the authorization read');}finally{env.DB=db;}
}
const originalFetch=globalThis.fetch;
try{
 await db.exec('CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,created_at TEXT);CREATE TABLE account_identities(provider TEXT,subject TEXT,user_id TEXT REFERENCES users(id));CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),created_at TEXT,expires_at TEXT);CREATE TABLE deletion_jobs(id TEXT PRIMARY KEY,owner_id TEXT,state TEXT);CREATE TABLE invitations(id TEXT PRIMARY KEY,owner_id TEXT REFERENCES users(id),content TEXT);CREATE TABLE media_assets(id TEXT PRIMARY KEY,owner_id TEXT REFERENCES users(id));CREATE TABLE native_auth_tickets(code_hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id));');
 for(const name of ['0005_replacement.sql','0006_service_accounts.sql','0007_operator_review.sql','0008_billing_ledger.sql','0009_billing_refund_notifications.sql'])for(const sql of (await readFile('cloudflare/migrations/'+name,'utf8')).replace(/^--.*$/gm,'').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
 for(let i=0;i<2;i++){const now=new Date().toISOString();await db.prepare('INSERT INTO users VALUES(?,NULL,?)').bind(owners[i],now).run();await db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').bind(await digest(tokens[i]),owners[i],now,new Date(Date.now()+86400000).toISOString()).run();await db.prepare('INSERT INTO w2_session_links VALUES(?,?,?)').bind(await digest(tokens[i]),owners[i],now).run();}
 await check('policy routes render and public config fails closed until real identity/transfer information exists',async()=>{for(const p of ['/privacy','/terms','/support','/settings'])assert.equal((await request(p)).status,200);const c=await request('/api/v2/account/config');assert.equal(c.data.privacyReady,false);assert.equal(c.data.appleEnabled,false);assert.equal(c.data.billingEnabled,false);});
 await check('anonymous support and deletion need a service login',async()=>{assert.equal((await request('/api/v2/account/support')).status,401);assert.equal((await request('/api/v2/account/deletion','DELETE',{confirm:'청첩장 계정 삭제'})).status,401);});
 await check('support denies foreign origin and oversize/invalid category',async()=>{assert.equal((await request('/api/v2/account/support','POST',{category:'other',message:'fixture'},0,{headers:{origin:'https://evil.invalid'}})).status,403);assert.equal((await request('/api/v2/account/support','POST',{category:'other',message:'x'.repeat(1001)},0)).status,400);assert.equal((await request('/api/v2/account/support','POST',{category:'invalid',message:'fixture'},0)).status,400);});
 const supportKey=crypto.randomUUID();let ticket;
 await check('support receipt is durable and duplicate delivery uses one ticket',async()=>{ticket=await request('/api/v2/account/support','POST',{category:'photo',message:'합성 문의'},0,{key:supportKey});assert.equal(ticket.status,201);const again=await request('/api/v2/account/support','POST',{category:'photo',message:'합성 문의'},0,{key:supportKey});assert.equal(again.data.id,ticket.data.id);});
 await check('another owner cannot read support and per-user quota caps new submissions',async()=>{assert.equal((await request('/api/v2/account/support','GET',undefined,1)).data.length,0);await request('/api/v2/account/support','POST',{category:'other',message:'두번째 합성 문의'},0);assert.equal((await request('/api/v2/account/support','POST',{category:'other',message:'한도 초과'},0)).status,429);});
 const now=new Date().toISOString(),photoIds=[crypto.randomUUID(),crypto.randomUUID()];
 for(let i=0;i<2;i++){const p=photoIds[i];await db.prepare("INSERT INTO w2_photos VALUES(?,?,?,?, 'ready',?,?,?)").bind(p,owners[i],`w2/${owners[i]}/${p}.webp`,16,crypto.randomUUID(),'fixture',now).run();await bucket.put(`w2/${owners[i]}/${p}.webp`,new Uint8Array(16));const content=JSON.stringify({coverPhoto:'/api/photos/'+p,gallery:[],options:{showGuestbook:true}});await db.prepare('INSERT INTO w2_invitations VALUES(?,?,1,?,?,?,?,?)').bind('release-check-'+i,owners[i],content,content,new Date(Date.now()+86400000).toISOString(),new Date(Date.now()+86400000).toISOString(),now).run();}
 let entry,guestCookie,reportId;
 await check('anonymous messages await approval and get stable browser attribution',async()=>{const read=await request('/api/v2/invitations/release-check-0/guestbook');guestCookie=read.headers.get('Set-Cookie').split(';')[0];const r=await request('/api/v2/invitations/release-check-0/guestbook','POST',{name:'합성하객',message:'축하합니다',password:'fixture-password'},-1,{headers:{cookie:guestCookie}});assert.equal(r.status,201);entry=r.data.id;assert.equal((await request('/api/v2/invitations/release-check-0/guestbook')).data.length,0);});
 await check('only owner can approve or block message authors',async()=>{assert.equal((await request('/api/v2/invitations/release-check-0/moderation','PATCH',{id:entry,approved:true},1)).status,404);assert.equal((await request('/api/v2/invitations/release-check-0/moderation','PATCH',{id:entry,approved:true},0)).status,200);});
 await check('report validates real published target and accepts anonymous receipt without exposing it publicly',async()=>{assert.equal((await request('/api/v2/reports','POST',{slug:'release-check-1',entryId:entry,reason:'abuse',message:''})).status,404);const r=await request('/api/v2/reports','POST',{slug:'release-check-0',entryId:entry,reason:'abuse',message:'합성 신고'});assert.equal(r.status,201);reportId=r.data.id;assert.equal((await request('/api/v2/reports')).status,405);assert.equal((await request('/api/v2/reports','POST',{slug:'release-check-0',reason:'invalid'})).status,400);});
 await check('blocked browser cannot post again and its existing message cannot be republished',async()=>{assert.equal((await request('/api/v2/invitations/release-check-0/moderation','POST',{id:entry},0)).status,200);assert.equal((await request('/api/v2/invitations/release-check-0/guestbook')).data.length,0);assert.equal((await request('/api/v2/invitations/release-check-0/guestbook','POST',{name:'이름변경',message:'재작성',password:'new-password'},-1,{headers:{cookie:guestCookie}})).status,403);assert.equal((await request('/api/v2/invitations/release-check-0/moderation','PATCH',{id:entry,approved:true},0)).status,403);});
 await check('concurrent browser block stops an already-authorized guest write at the database boundary',async()=>{
  const count=(await db.prepare('SELECT COUNT(*) AS n FROM w2_guestbook').first()).n;
  await afterFirstRead('SELECT author_key FROM w2_guest_blocks WHERE',async([slug,key])=>{await db.prepare('INSERT INTO w2_guest_blocks VALUES(?,?,?)').bind(slug,key,new Date().toISOString()).run();},async()=>{
   const r=await request('/api/v2/invitations/release-check-0/guestbook','POST',{name:'경합 점검',message:'차단 직후 요청',password:'fixture-password'},-1,{headers:{cookie:'__Host-w2-guest='+'a'.repeat(64)}});assert.equal(r.status,409);
  });
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM w2_guestbook').first()).n,count);
 });
 await check('concurrent browser block stops an already-authorized approval from publishing a message',async()=>{
  const r=await request('/api/v2/invitations/release-check-0/guestbook','POST',{name:'승인 경합',message:'승인 직후 차단',password:'fixture-password'},-1,{headers:{cookie:'__Host-w2-guest='+'b'.repeat(64)}});assert.equal(r.status,201);
  await afterFirstRead('SELECT b.author_key FROM w2_guest_blocks',async([slug,id])=>{const a=await db.prepare('SELECT author_key FROM w2_guest_authors WHERE entry_id=?').bind(id).first();await db.prepare('INSERT INTO w2_guest_blocks VALUES(?,?,?)').bind(slug,a.author_key,new Date().toISOString()).run();},async()=>{
   assert.equal((await request('/api/v2/invitations/release-check-0/moderation','PATCH',{id:r.data.id,approved:true},0)).status,409);
  });
  assert.equal((await db.prepare('SELECT approved FROM w2_guestbook WHERE id=?').bind(r.data.id).first()).approved,0);
 });
 await check('operator review defaults closed and requires a server-assigned role',async()=>{
  assert.equal((await request('/api/v2/operator/queue')).status,401);
  assert.equal((await request('/api/v2/operator/queue','GET',undefined,1)).status,403);
  env.WEDDING_OPERATOR_IDS='malformed-role';assert.equal((await request('/api/v2/operator/queue','GET',undefined,1)).status,403);
  env.WEDDING_OPERATOR_IDS=owners[1];assert.equal((await request('/api/v2/operator/queue','GET',undefined,0)).status,403);
  const queue=await request('/api/v2/operator/queue','GET',undefined,1);assert.equal(queue.status,200);assert.ok(queue.data.support.some(t=>t.id===ticket.data.id));assert.ok(queue.data.reports.some(r=>r.id===reportId));
 });
 await check('older unresolved tickets and reports stay visible behind more than fifty resolved records',async()=>{
  const supportIds=[],reportIds=[],createdAt=new Date(Date.now()+86400000).toISOString();
  for(let i=0;i<51;i++){
   const sid=crypto.randomUUID(),rid=crypto.randomUUID();supportIds.push(sid);reportIds.push(rid);
   await db.prepare("INSERT INTO w2_support(id,owner_id,category,message,status,created_at,mutation_id) VALUES(?,?,'other','synthetic backlog','resolved',?,?)").bind(sid,owners[0],createdAt,crypto.randomUUID()).run();
   await db.prepare("INSERT INTO w2_reports(id,slug,reporter_key,reason,message,status,created_at,mutation_id) VALUES(?,'release-check-0','synthetic backlog','other','synthetic backlog','dismissed',?,?)").bind(rid,createdAt,crypto.randomUUID()).run();
  }
  try{
   const queue=await request('/api/v2/operator/queue','GET',undefined,1);assert.equal(queue.status,200);
   assert.equal(queue.data.support.length,50);assert.equal(queue.data.reports.length,50);
   assert.ok(queue.data.support.some(t=>t.id===ticket.data.id));assert.ok(queue.data.reports.some(r=>r.id===reportId));
   assert.equal(queue.data.support[0].status,'received');assert.equal(queue.data.reports[0].status,'received');
  }finally{
   await db.prepare(`DELETE FROM w2_support WHERE id IN(${supportIds.map(()=>'?').join(',')})`).bind(...supportIds).run();
   await db.prepare(`DELETE FROM w2_reports WHERE id IN(${reportIds.map(()=>'?').join(',')})`).bind(...reportIds).run();
  }
 });
 await check('operator replies are private to the ticket owner and retry creates one audit record',async()=>{
  const key=crypto.randomUUID(),body={id:ticket.data.id,reply:'합성 문의에 대한 테스트 답변'};
  assert.equal((await request('/api/v2/operator/support','POST',body,0)).status,403);
  assert.equal((await request('/api/v2/operator/support','POST',body,1,{headers:{origin:'https://evil.invalid'}})).status,403);
  assert.equal((await request('/api/v2/operator/support','POST',{...body,reply:'x'.repeat(1001)},1)).status,400);
  assert.equal((await request('/api/v2/operator/support','POST',body,1,{key})).status,200);
  assert.equal((await request('/api/v2/operator/support','POST',body,1,{key})).status,200);
  assert.equal((await request('/api/v2/operator/support','POST',{...body,reply:'다른 답변'},1,{key})).status,409);
  const mine=(await request('/api/v2/account/support','GET',undefined,0)).data;assert.equal(mine.find(t=>t.id===body.id).reply,body.reply);assert.equal(mine.find(t=>t.id===body.id).status,'resolved');
  assert.equal((await request('/api/v2/account/support','GET',undefined,1)).data.length,0);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM w2_operator_actions WHERE action='support-reply'").first()).n,1);
 });
 await check('operator restriction blocks public pages, photos, guest replies and owner republish, including a stale snapshot',async()=>{
  assert.equal((await request('/api/v2/operator/reports','POST',{id:reportId,decision:'hold'},0)).status,403);
  assert.equal((await request('/api/v2/operator/reports','POST',{id:reportId,decision:'hold'},1)).status,200);
  const data=(await db.prepare('SELECT data FROM w2_invitations WHERE slug=?').bind('release-check-0').first()).data;
  await db.prepare('UPDATE w2_invitations SET public_data=?,public_expires_at=? WHERE slug=?').bind(data,new Date(Date.now()+86400000).toISOString(),'release-check-0').run();
  assert.equal((await request('/api/v2/invitations/release-check-0')).status,404);
  assert.equal((await request('/api/v2/invitations/release-check-0/guestbook')).status,404);
  assert.equal((await request('/api/v2/photos/'+photoIds[0])).status,404);
  assert.equal((await request('/api/v2/invitations/release-check-0','GET',undefined,0)).data.published,false);
  assert.equal((await request('/api/v2/invitations/release-check-0/publish','POST',{published:true,revision:1},0)).status,403);
  assert.equal((await request('/api/v2/invitations/release-check-0/guestbook','POST',{name:'합성하객',message:'추가 글',password:'fixture-password'})).status,404);
  assert.equal((await request('/api/v2/operator/reports','POST',{id:reportId,decision:'hide-entry'},1)).status,200);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM w2_guestbook WHERE id=?').bind(entry).first()).n,0);
  assert.equal((await request('/api/v2/invitations/release-check-1')).status,200);
  // Return to the actual held state before release. Releasing never republishes a snapshot.
  await db.prepare('UPDATE w2_invitations SET public_data=NULL,public_expires_at=NULL WHERE slug=?').bind('release-check-0').run();
  assert.equal((await request('/api/v2/operator/reports','POST',{id:reportId,decision:'release'},1)).status,200);
  assert.equal((await request('/api/v2/invitations/release-check-0')).status,404);
 });
 await check('Apple authentication remains disabled without provider and encryption settings',async()=>assert.equal((await request('/api/v2/auth/apple/challenge','POST',{})).status,503));
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const key={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'synthetic-fixture',alg:'RS256',use:'sig'};
 const jwt=async(claims,header={alg:'RS256',kid:key.kid})=>{const p=Buffer.from(JSON.stringify(header)).toString('base64url')+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url');return p+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(p))).toString('base64url');};
 const nonce='a'.repeat(64),claims={iss:'https://appleid.apple.com',aud:'com.invitehub.wedding-preview',sub:'synthetic-apple-user',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300,nonce};
 await check('Apple identity signature and issuer/audience/expiry/nonce are verified, not trusted from client',async()=>{const valid=await jwt(claims);assert.equal((await verifyAppleIdentity(valid,await digest(nonce),claims.aud,[key])).sub,claims.sub);for(const bad of [{...claims,aud:'another.app'},{...claims,iss:'https://evil.invalid'},{...claims,exp:Math.floor(Date.now()/1000)-1},{...claims,nonce:'b'.repeat(64)}])await assert.rejects(verifyAppleIdentity(await jwt(bad),await digest(nonce),claims.aud,[key]));await assert.rejects(verifyAppleIdentity(valid.slice(0,-3)+'bad',await digest(nonce),claims.aud,[key]));await assert.rejects(verifyAppleIdentity(await jwt(claims,{alg:'RS256',kid:key.kid,jku:'https://evil.invalid/keys'}),await digest(nonce),claims.aud,[key]));});
 // All provider calls below are isolated local stubs. Never use this secret or key remotely.
 env.APPLE_CLIENT_SECRET=Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({iss:'3FG9QJC8WC',sub:claims.aud,aud:claims.iss,exp:claims.exp})).toString('base64url')+'.synthetic';
 env.APPLE_TOKEN_ENCRYPTION_KEY=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
 await db.prepare("UPDATE w2_controls SET enabled=1 WHERE name='apple_login'").run();
 let providerToken,revocations=0,exchanges=0,revokeStatus=200;
 globalThis.fetch=async(url,options)=>{if(url==='https://appleid.apple.com/auth/keys')return Response.json({keys:[key]});if(url==='https://appleid.apple.com/auth/token'){assert.equal(options.method,'POST');exchanges++;return Response.json({id_token:providerToken,refresh_token:'synthetic-refresh-token'});}if(url==='https://appleid.apple.com/auth/revoke'){assert.equal(new URLSearchParams(options.body).get('token'),'synthetic-refresh-token');revocations++;return new Response(null,{status:revokeStatus});}throw new Error('Unexpected fixture network URL');};
 let appleCookie,appleOwner;
 await check('Apple one-time flow issues HttpOnly service session only after code and token validation',async()=>{const challenge=await request('/api/v2/auth/apple/challenge','POST',{});assert.equal(challenge.status,200);providerToken=await jwt({...claims,nonce:challenge.data.nonce});const body={flowId:challenge.data.id,identityToken:providerToken,authorizationCode:'synthetic-code'};const done=await request('/api/v2/auth/apple/complete','POST',body);assert.equal(done.status,303);assert.ok(done.headers.get('Set-Cookie').includes('HttpOnly'));assert.equal(new URL(done.headers.get('Location')).pathname,'/my');appleCookie=done.headers.get('Set-Cookie').split(';')[0];const s=await request('/api/v2/auth/session','GET',undefined,-1,{headers:{cookie:appleCookie}});appleOwner=s.data.id;assert.ok(appleOwner);assert.equal((await request('/api/v2/auth/apple/complete','POST',body)).status,401);const c=await db.prepare('SELECT refresh_cipher FROM w2_apple_identities WHERE owner_id=?').bind(appleOwner).first();assert.ok(!c.refresh_cipher.includes('synthetic-refresh-token'));});
 const legacyToken=crypto.randomUUID().replaceAll('-','')+'0123456789abcdef';
 await db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').bind(await digest(legacyToken),owners[0],new Date(Date.now()-1000).toISOString(),new Date(Date.now()+86400000).toISOString()).run();
 await db.prepare("INSERT INTO account_identities VALUES('google','synthetic-shared-legacy',?)").bind(owners[0]).run();
 await db.prepare("INSERT INTO invitations VALUES('legacy-preserved',?,'untouched fixture')").bind(owners[0]).run();
 await db.prepare('INSERT INTO w2_photo_activity VALUES(?,?)').bind(photoIds[0],Date.now()+60000).run();
 await check('account deletion requires explicit confirmation and fresh login',async()=>{assert.equal((await request('/api/v2/account/deletion','DELETE',{confirm:'wrong'},0)).status,400);await db.prepare('UPDATE sessions SET created_at=? WHERE token_hash=?').bind(new Date(Date.now()-20*60000).toISOString(),await digest(tokens[1])).run();assert.equal((await request('/api/v2/account/deletion','DELETE',{confirm:'청첩장 계정 삭제'},1)).status,403);});
 await check('service account deletion immediately closes links, replies, tickets and its sessions while preserving old product data',async()=>{const r=await request('/api/v2/account/deletion','DELETE',{confirm:'청첩장 계정 삭제'},0);assert.equal(r.status,200);assert.equal((await request('/api/v2/auth/session','GET',undefined,0)).status,401);assert.equal((await request('/api/v2/invitations/release-check-0')).status,404);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM w2_support WHERE owner_id=?').bind(owners[0]).first()).n,0);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM w2_guestbook WHERE slug=?').bind('release-check-0').first()).n,0);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE token_hash=?').bind(await digest(legacyToken)).first()).n,1);assert.equal((await db.prepare("SELECT content FROM invitations WHERE id='legacy-preserved'").first()).content,'untouched fixture');assert.equal((await request('/api/v2/auth/session','GET',undefined,-1,{headers:{cookie:'__Host-osam-session='+legacyToken}})).status,401);});
 await check('cleanup waits for in-flight photo lease, then removes only deleted owner media',async()=>{await cleanup(env);assert.ok(await bucket.get(`w2/${owners[0]}/${photoIds[0]}.webp`));assert.equal((await db.prepare('SELECT state FROM w2_account_deletions WHERE owner_id=?').bind(owners[0]).first()).state,'pending');await db.prepare('DELETE FROM w2_photo_activity WHERE photo_id=?').bind(photoIds[0]).run();await cleanup(env);assert.equal(await bucket.get(`w2/${owners[0]}/${photoIds[0]}.webp`),null);assert.ok(await bucket.get(`w2/${owners[1]}/${photoIds[1]}.webp`));assert.equal((await db.prepare('SELECT state FROM w2_account_deletions WHERE owner_id=?').bind(owners[0]).first()).state,'complete');assert.equal((await request('/api/v2/auth/session','GET',undefined,-1,{headers:{cookie:'__Host-osam-session='+legacyToken}})).status,401);});
 await check('deleting Apple identity cannot reconnect before provider revocation or make another code exchange',async()=>{
  const r=await request('/api/v2/account/deletion','DELETE',{confirm:'청첩장 계정 삭제'},-1,{headers:{cookie:appleCookie}});assert.equal(r.status,200);
  const challenge=await request('/api/v2/auth/apple/challenge','POST',{});providerToken=await jwt({...claims,nonce:challenge.data.nonce});
  const before=exchanges;assert.equal((await request('/api/v2/auth/apple/complete','POST',{flowId:challenge.data.id,identityToken:providerToken,authorizationCode:'synthetic-code'})).status,409);assert.equal(exchanges,before);
  revokeStatus=503;await cleanup(env);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM users WHERE id=?').bind(appleOwner).first()).n,1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM w2_apple_revocations WHERE owner_id=?').bind(appleOwner).first()).n,1);
  assert.equal((await db.prepare('SELECT state FROM w2_account_deletions WHERE owner_id=?').bind(appleOwner).first()).state,'pending');
 });
 await check('successful Apple revocation removes mapping, encrypted token and independent account ID while preserving legacy users',async()=>{
  revokeStatus=200;await cleanup(env);assert.equal(revocations,2);
  for(const table of ['w2_apple_identities','w2_apple_revocations'])assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM '+table+' WHERE owner_id=?').bind(appleOwner).first()).n,0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM users WHERE id=?').bind(appleOwner).first()).n,0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM users WHERE id=?').bind(owners[0]).first()).n,1);
  assert.equal((await db.prepare("SELECT content FROM invitations WHERE id='legacy-preserved'").first()).content,'untouched fixture');
 });
 await writeFile('docs/evidence/store-release-20261007/accounts-local.json',JSON.stringify({environment:'isolated local D1/R2 and stubbed Apple provider; no production writes or real OAuth',pass:checks.length,fail:0,checks},null,2)+'\n');
 console.log(`${checks.length} checks passed; provider and real-device proof remain separate.`);
}finally{globalThis.fetch=originalFetch;await mf.dispose();}

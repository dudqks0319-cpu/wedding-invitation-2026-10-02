import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const toolchain=path.resolve('../osam-rebuild/node_modules');
const {Miniflare,convertV4MiniflareOptions}=await import(pathToFileURL(path.join(toolchain,'miniflare/dist/src/index.js')).href);
const {default:worker,recordVerifiedAppleTransaction:record,recordVerifiedAppleRefundNotification:notification,
 applyEventCredit:apply,eventCreditStatus:status,billingSummary:summary}=await import('../cloudflare/build/replacement.mjs');
const mf=new Miniflare(convertV4MiniflareOptions({name:'event-credit-fixture',modules:true,
 scriptPath:path.resolve('cloudflare/build/replacement.mjs'),compatibilityDate:'2026-09-29',compatibilityFlags:['nodejs_compat'],
 d1Databases:{DB:'isolated-event-credit-db'},r2Buckets:['MEDIA']}));
const db=await mf.getD1Database('DB'),origin='https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site';
const env={DB:db,MEDIA:await mf.getR2Bucket('MEDIA'),ABUSE_HMAC_SECRET:'synthetic-local-only-hmac-secret-32bytes',NEXT_PUBLIC_SITE_URL:origin};
const now=Date.now(),checks=[];let next=30000;
const reject=(promise,code)=>assert.rejects(promise,e=>e.status===code);
const facts=(owner,id=String(++next),extra={})=>({transactionId:id,productId:'com.invitehub.wedding-preview.event-credit.v1',
 bundleId:'com.invitehub.wedding-preview',environment:'Production',appAccountToken:owner.token,purchaseDate:now-60000,signedDate:now,...extra});
async function check(name,fn){await fn();checks.push({name,result:'PASS'});console.log('PASS',name);}
async function account(){
 const a={id:crypto.randomUUID(),token:crypto.randomUUID(),cookie:crypto.randomUUID().replaceAll('-','')+'0123456789abcdef'};
 await db.prepare('INSERT INTO users VALUES(?,?,?)').bind(a.id,'synthetic@example.invalid',new Date(now).toISOString()).run();
 await db.prepare('INSERT INTO w2_billing_accounts VALUES(?,?,?)').bind(a.id,a.token,new Date(now).toISOString()).run();
 const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(a.cookie))).toString('hex');
 await db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').bind(hash,a.id,new Date(now).toISOString(),new Date(now+86400000).toISOString()).run();
 return a;
}
async function invitation(a,slug='event-'+(++next)){
 await db.prepare('INSERT INTO w2_invitations VALUES(?,?,1,?,NULL,?,NULL,?)').bind(slug,a.id,'{}',new Date(now+86400000).toISOString(),new Date(now).toISOString()).run();return slug;
}
async function refund(a,id,type='REFUND',at=now){
 await notification(env,{notificationUUID:crypto.randomUUID(),notificationType:type,signedDate:at,
  bundleId:'com.invitehub.wedding-preview',environment:'Production',transaction:facts(a,id,{signedDate:at,...(type==='REFUND'?{revocationDate:at-1000}:{})})});
}
async function raceBeforeInsert(mutate,operation){
 const original=env.DB;let fired=false;
 env.DB={batch:q=>original.batch(q),prepare(sql){
  const query=original.prepare(sql);if(!sql.startsWith('SELECT slug FROM w2_invitations'))return query;
  return {bind(...values){const bound=query.bind(...values);return {async first(){
   const row=await bound.first();if(!fired){fired=true;await mutate();}return row;
  }};}};
 }};
 try{await operation();assert.ok(fired);}finally{env.DB=original;}
}
try{
 await db.exec('CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,created_at TEXT);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),created_at TEXT,expires_at TEXT);CREATE TABLE deletion_jobs(id TEXT PRIMARY KEY,owner_id TEXT,state TEXT);');
 for(const name of ['0005_replacement.sql','0006_service_accounts.sql','0007_operator_review.sql','0008_billing_ledger.sql','0009_billing_refund_notifications.sql','0010_billing_event_credits.sql'])
  for(const sql of (await readFile('cloudflare/migrations/'+name,'utf8')).replace(/^--.*$/gm,'').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
 await check('concurrent replay applies once and removes consumed credit from available balance',async()=>{
  const a=await account(),s=await invitation(a),t=facts(a);await record(env,t);
  const replies=await Promise.all(Array.from({length:5},()=>apply(env,a.id,s,t.transactionId)));
  assert.ok(replies.every(r=>r.durablyApplied&&r.state==='applied'));
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM w2_event_credits WHERE transaction_id=?').bind(t.transactionId).first()).n,1);
  assert.deepEqual(await summary(env,a.id),{available:0,refunded:0});
 });
 await check('one transaction cannot pay for two invitations even in a race',async()=>{
  const a=await account(),s=await invitation(a),other=await invitation(a),t=facts(a);await record(env,t);
  const replies=await Promise.allSettled([apply(env,a.id,s,t.transactionId),apply(env,a.id,other,t.transactionId)]);
  assert.equal(replies.filter(r=>r.status==='fulfilled').length,1);assert.equal(replies.find(r=>r.status==='rejected').reason.status,409);
  assert.equal([await status(env,a.id,s),await status(env,a.id,other)].filter(r=>r.state==='active').length,1);
 });
 await check('competing credits do not consume an extra credit for the same active invitation',async()=>{
  const a=await account(),s=await invitation(a),one=facts(a),two=facts(a);await record(env,one);await record(env,two);
  const replies=await Promise.allSettled([apply(env,a.id,s,one.transactionId),apply(env,a.id,s,two.transactionId)]);
  assert.equal(replies.filter(r=>r.status==='fulfilled').length,1);assert.equal((await summary(env,a.id)).available,1);
 });
 await check('another owner, missing record and Sandbox cannot grant production entitlement',async()=>{
  const a=await account(),b=await account(),s=await invitation(a),other=await invitation(b),t=facts(a);await record(env,t);
  await reject(status(env,b.id,s),404);await reject(apply(env,b.id,s,t.transactionId),404);
  await reject(apply(env,b.id,other,t.transactionId),409);await reject(apply(env,a.id,s,'9999999'),409);
  const sandbox=facts(a,undefined,{environment:'Sandbox'});await record(env,sandbox);await reject(apply(env,a.id,s,sandbox.transactionId),409);
  assert.equal((await status(env,a.id,s)).state,'none');
 });
 await check('refund disables current entitlement; reversal restores its original event without freeing credit',async()=>{
  const a=await account(),s=await invitation(a),other=await invitation(a),t=facts(a);await record(env,t);await apply(env,a.id,s,t.transactionId);
  await refund(a,t.transactionId,'REFUND',now-10000);assert.equal((await status(env,a.id,s)).state,'refunded');
  await reject(apply(env,a.id,other,t.transactionId),409);
  await refund(a,t.transactionId,'REFUND_REVERSED',now);assert.equal((await status(env,a.id,s)).state,'active');
  assert.equal((await summary(env,a.id)).available,0);await reject(apply(env,a.id,other,t.transactionId),409);
 });
 await check('repurchase after refund works; old reversal or replay cannot replace the newer event assignment',async()=>{
  const a=await account(),s=await invitation(a),old=facts(a),fresh=facts(a);await record(env,old);await record(env,fresh);
  await apply(env,a.id,s,old.transactionId);await refund(a,old.transactionId,'REFUND',now-10000);
  await apply(env,a.id,s,fresh.transactionId);await refund(a,old.transactionId,'REFUND_REVERSED',now);
  assert.deepEqual(await status(env,a.id,s),{state:'active',transactionId:fresh.transactionId});
  await reject(apply(env,a.id,s,old.transactionId),409);assert.equal((await summary(env,a.id)).available,0);
  await refund(a,fresh.transactionId,'REFUND',now);assert.equal((await status(env,a.id,s)).state,'refunded');
 });
 await check('invitation deletion removes its slug but keeps transaction consumed across recreation',async()=>{
  const a=await account(),s=await invitation(a),t=facts(a);await record(env,t);await apply(env,a.id,s,t.transactionId);
  await db.prepare('DELETE FROM w2_invitations WHERE slug=?').bind(s).run();
  assert.equal((await db.prepare('SELECT invitation_slug FROM w2_event_credits WHERE transaction_id=?').bind(t.transactionId).first()).invitation_slug,null);
  await invitation(a,s);await reject(apply(env,a.id,s,t.transactionId),409);assert.equal((await summary(env,a.id)).available,0);
 });
 await check('real isolated account-deletion route unlinks entitlement without deleting the legacy user',async()=>{
  const a=await account(),s=await invitation(a),t=facts(a);await record(env,t);await apply(env,a.id,s,t.transactionId);
  const response=await worker.fetch(new Request(origin+'/api/v2/account/deletion',{method:'DELETE',
   headers:{Origin:origin,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),Cookie:'__Host-osam-session='+a.cookie,'cf-connecting-ip':'192.0.2.81'},
   body:JSON.stringify({confirm:'청첩장 계정 삭제'})}),env);
  assert.equal(response.status,200);await reject(status(env,a.id,s),404);
  assert.equal((await db.prepare('SELECT invitation_slug FROM w2_event_credits WHERE transaction_id=?').bind(t.transactionId).first()).invitation_slug,null);
  assert.equal((await db.prepare('SELECT owner_id FROM w2_apple_transactions WHERE transaction_id=?').bind(t.transactionId).first()).owner_id,null);
  assert.ok(await db.prepare('SELECT id FROM users WHERE id=?').bind(a.id).first());
 });
 await check('deletion between owner lookup and insertion cannot revive credit',async()=>{
  const a=await account(),s=await invitation(a),t=facts(a);await record(env,t);
  await raceBeforeInsert(()=>db.prepare("INSERT INTO w2_account_deletions VALUES(?,?,'pending',0)").bind(a.id,new Date().toISOString()).run(),()=>reject(apply(env,a.id,s,t.transactionId),404));
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM w2_event_credits WHERE transaction_id=?').bind(t.transactionId).first()).n,0);
 });
 await check('refund between owner lookup and insertion does not grant entitlement',async()=>{
  const a=await account(),s=await invitation(a),t=facts(a);await record(env,t);
  await raceBeforeInsert(()=>refund(a,t.transactionId),()=>reject(apply(env,a.id,s,t.transactionId),409));
  assert.equal((await status(env,a.id,s)).state,'none');
 });
 await check('expired invitation or legacy pending deletion cannot receive credit',async()=>{
  const a=await account(),s=await invitation(a),t=facts(a);await record(env,t);
  await db.prepare('UPDATE w2_invitations SET expires_at=? WHERE slug=?').bind(new Date(now-1).toISOString(),s).run();await reject(apply(env,a.id,s,t.transactionId),404);
  await db.prepare('UPDATE w2_invitations SET expires_at=? WHERE slug=?').bind(new Date(now+86400000).toISOString(),s).run();
  await db.prepare("INSERT INTO deletion_jobs VALUES(?,?,'pending')").bind(crypto.randomUUID(),a.id).run();await reject(apply(env,a.id,s,t.transactionId),404);
 });
 await check('invalid IDs and slugs are rejected and 64-digit string IDs preserve precision',async()=>{
  const a=await account(),s=await invitation(a),t=facts(a,'9'.repeat(64));await record(env,t);
  for(const id of [1,'9'.repeat(65),'1 OR 1=1'])await reject(apply(env,a.id,s,id),400);
  for(const slug of ['../private','UPPER','x'.repeat(31)])await reject(apply(env,a.id,slug,t.transactionId),400);
  assert.equal((await apply(env,a.id,s,t.transactionId)).transactionId,t.transactionId);
 });
 await check('new internal foundation opens no HTTP paid action even when billing flag is enabled',async()=>{
  const a=await account();await db.prepare("UPDATE w2_controls SET enabled=1 WHERE name='billing'").run();
  for(const [action,expected] of [['apply',404],['deliver',503],['prepare',503]]){
   const reply=await worker.fetch(new Request(origin+'/api/v2/billing/'+action,{method:'POST',headers:{Origin:origin,
    'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),Cookie:'__Host-osam-session='+a.cookie,'cf-connecting-ip':'192.0.2.82'},body:'{}'}),env);
   assert.equal(reply.status,expected);
  }
 });
 const output={scope:'isolated D1, synthetic already-verified Apple facts; no actual store signature/purchase or premium benefit proof',
  httpBillingEnabled:false,productionDeployment:false,checks};
 await writeFile('docs/evidence/store-release-20261007/event-credits-local.json',JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify({passed:checks.length}));
}finally{await mf.dispose();}

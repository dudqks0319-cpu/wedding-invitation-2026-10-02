import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=process.cwd(),toolchain=path.resolve(root,'../osam-rebuild/node_modules');
const {Miniflare,convertV4MiniflareOptions}=await import(pathToFileURL(path.join(toolchain,'miniflare/dist/src/index.js')).href);
const {default:worker,recordVerifiedAppleTransaction:record,recordVerifiedAppleRefundNotification:refundNotification,billingSummary}=await import('../cloudflare/build/replacement.mjs');
const origin='https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site';
const mf=new Miniflare(convertV4MiniflareOptions({name:'billing-ledger-fixture',modules:true,
 scriptPath:path.join(root,'cloudflare/build/replacement.mjs'),compatibilityDate:'2026-09-29',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'isolated-billing-db'},r2Buckets:['MEDIA']}));
const db=await mf.getD1Database('DB'),env={DB:db,MEDIA:await mf.getR2Bucket('MEDIA'),
 ABUSE_HMAC_SECRET:'synthetic-local-only-hmac-secret-32bytes',NEXT_PUBLIC_SITE_URL:origin};
const owners=[crypto.randomUUID(),crypto.randomUUID()],accounts=[crypto.randomUUID(),crypto.randomUUID()],
 cookies=owners.map(()=>crypto.randomUUID().replaceAll('-','')+'0123456789abcdef');
const now=Date.now(),checks=[];
const facts=(id,extra={})=>({transactionId:id,productId:'com.invitehub.wedding-preview.event-credit.v1',
 bundleId:'com.invitehub.wedding-preview',environment:'Production',appAccountToken:accounts[0],purchaseDate:now-60000,signedDate:now,...extra});
const notice=(id,type,at=now,extra={},transactionExtra={})=>({notificationUUID:crypto.randomUUID(),
 notificationType:type,signedDate:at,environment:'Production',bundleId:'com.invitehub.wedding-preview',
 transaction:facts(id,{signedDate:at,...(type==='REFUND'?{revocationDate:at-1000}:{}),...transactionExtra}),...extra});
const reject=(promise,status)=>assert.rejects(promise,e=>e.status===status);
async function check(name,fn){await fn();checks.push({name,result:'PASS'});console.log('PASS',name);}
let seq=0;
async function request(action,method='POST',who=0,headers={}){
 const response=await worker.fetch(new Request(origin+'/api/v2/'+action,{method,
  headers:{'cf-connecting-ip':`192.0.2.${++seq}`,Origin:origin,'Content-Type':'application/json',
   'Idempotency-Key':crypto.randomUUID(),...(who<0?{}:{cookie:'__Host-osam-session='+cookies[who]}),...headers},
  ...(['GET','HEAD'].includes(method)?{}:{body:JSON.stringify({confirm:'청첩장 계정 삭제',signedTransaction:'synthetic.invalid.jws'})})}),env);
 return {status:response.status,data:await response.json()};
}
try{
 await db.exec('CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,created_at TEXT);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),created_at TEXT,expires_at TEXT);CREATE TABLE deletion_jobs(id TEXT PRIMARY KEY,owner_id TEXT,state TEXT);');
 for(const name of ['0005_replacement.sql','0006_service_accounts.sql','0007_operator_review.sql','0008_billing_ledger.sql','0009_billing_refund_notifications.sql','0010_billing_event_credits.sql']){
  if(name.startsWith('0009'))await db.prepare('INSERT INTO w2_apple_transactions VALUES(?,?,?,?,NULL,?,?,?,?)')
   .bind('Production','6999',facts('6999').productId,'synthetic-migration-token-hash',now-60000,now-10000,now-11000,new Date(now).toISOString()).run();
  for(const sql of (await readFile('cloudflare/migrations/'+name,'utf8')).replace(/^--.*$/gm,'').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
 }
 await check('schema upgrade preserves existing refund tombstones and backfills their ordering timestamp',async()=>{
  const legacy=await db.prepare("SELECT revoked_at,refund_state_signed_at FROM w2_apple_transactions WHERE transaction_id='6999'").first();
  assert.deepEqual(legacy,{revoked_at:now-11000,refund_state_signed_at:now-10000});
  await db.prepare("DELETE FROM w2_apple_transactions WHERE transaction_id='6999'").run();
 });
 for(let i=0;i<2;i++){
  await db.prepare('INSERT INTO users VALUES(?,NULL,?)').bind(owners[i],new Date(now).toISOString()).run();
  const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(cookies[i]))).toString('hex');
  await db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').bind(hash,owners[i],new Date(now).toISOString(),new Date(now+86400000).toISOString()).run();
  await db.prepare('INSERT INTO w2_billing_accounts VALUES(?,?,?)').bind(owners[i],accounts[i],new Date(now).toISOString()).run();
 }
 await check('HTTP billing stays closed without verifier even with billing control enabled',async()=>{
  assert.equal((await request('billing/prepare','POST',-1)).status,401);
  assert.equal((await request('billing/prepare','POST',0,{Origin:'https://evil.invalid'})).status,403);
  for(const enabled of [0,1]){
   await db.prepare("UPDATE w2_controls SET enabled=? WHERE name='billing'").bind(enabled).run();
   assert.equal((await request('billing/prepare')).status,503);
   assert.equal((await request('billing/deliver')).status,503);
   assert.equal((await request('account/config','GET')).data.billingEnabled,false);
  }
  assert.equal((await request('billing/notifications')).status,404);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM w2_apple_transactions').first()).n,0);
 });
 await check('duplicate and concurrent verified facts create exactly one production credit with string transaction IDs',async()=>{
  const id='9007199254740993',input=facts(id);
  const replies=await Promise.all(Array.from({length:5},()=>record(env,input)));
  assert.ok(replies.every(r=>r.transactionId===id&&r.state==='credited'&&r.durablyRecorded));
  assert.equal((await billingSummary(env,owners[0])).available,1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM w2_apple_transactions').first()).n,1);
 });
 await check('wrong app, product, account, dates and numeric transaction IDs cannot create credit',async()=>{
  for(const extra of [{bundleId:'another.app'},{productId:'unapproved.product'},{environment:'Unknown'},
   {transactionId:9007199254740993},{appAccountToken:'not-uuid'},{purchaseDate:0},{signedDate:now+86400000},
   {revocationDate:now-120000}])await assert.rejects(record(env,facts('1002',extra)),e=>e.status===400,JSON.stringify(extra));
  await reject(record(env,facts('1002',{appAccountToken:crypto.randomUUID()})),403);
  await reject(record(env,facts('9007199254740993',{appAccountToken:accounts[1]})),409);
  await reject(record(env,facts('9007199254740993',{purchaseDate:now-59000})),409);
  assert.equal((await billingSummary(env,owners[1])).available,0);
 });
 await check('sandbox records remain separate and never count as production credit',async()=>{
  await record(env,facts('9007199254740993',{environment:'Sandbox'}));
  assert.equal((await billingSummary(env,owners[0])).available,1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM w2_apple_transactions').first()).n,2);
 });
 await check('refund revokes credit once and older purchase replay cannot undo it',async()=>{
  const refund=facts('9007199254740993',{revocationDate:now-1000});
  await Promise.all([record(env,refund),record(env,refund)]);
  assert.equal((await record(env,facts('9007199254740993',{signedDate:now-5000}))).state,'refunded');
  assert.deepEqual(await billingSummary(env,owners[0]),{available:0,refunded:1});
 });
 await check('refund before initial delivery leaves a tombstone instead of granting on later delivery',async()=>{
  await record(env,facts('1003',{revocationDate:now-1000}));
  assert.equal((await record(env,facts('1003'))).state,'refunded');
  assert.equal((await billingSummary(env,owners[0])).available,0);
 });
 await check('verified refund reversal restores one credit including a retained nested revocationDate',async()=>{
  await refundNotification(env,notice('2001','REFUND',now-20000));
  const reversal=notice('2001','REFUND_REVERSED',now-10000,{}, {revocationDate:now-21000});
  const results=await Promise.all(Array.from({length:5},()=>refundNotification(env,reversal)));
  assert.ok(results.every(r=>r.state==='credited'&&r.durablyRecorded));
  assert.equal((await billingSummary(env,owners[0])).available,1);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM w2_apple_refund_notifications WHERE transaction_id='2001'").first()).n,2);
  await refundNotification(env,notice('2001','REFUND',now-5000));
  assert.equal((await billingSummary(env,owners[0])).available,0);
 });
 await check('arrival order and ordinary purchase retries cannot undo the latest refund decision',async()=>{
  const refund=notice('2002','REFUND',now-30000),reversal=notice('2002','REFUND_REVERSED',now-20000);
  await refundNotification(env,reversal);
  assert.equal((await refundNotification(env,refund)).state,'credited');
  assert.equal((await record(env,facts('2002',{signedDate:now-30000,revocationDate:now-31000}))).state,'credited');
  await refundNotification(env,notice('2002','REFUND',now-10000));
  assert.equal((await refundNotification(env,reversal)).state,'refunded');
  assert.equal((await record(env,facts('2002'))).state,'refunded');
  assert.equal((await billingSummary(env,owners[0])).available,0);
 });
 await check('a later verified transaction refund revokes after a reversal but unrevoked delivery never reinstates',async()=>{
  await refundNotification(env,notice('2003','REFUND_REVERSED',now-20000));
  assert.equal((await record(env,facts('2003',{signedDate:now-10000,revocationDate:now-11000}))).state,'refunded');
  assert.equal((await record(env,facts('2003'))).state,'refunded');
  assert.equal((await refundNotification(env,notice('2003','REFUND_REVERSED',now-15000))).state,'refunded');
  assert.equal((await billingSummary(env,owners[0])).available,0);
 });
 await check('equal signedDate conflicts conservatively retain refund in either arrival order',async()=>{
  for(const [id,types] of [['2004',['REFUND','REFUND_REVERSED']],['2005',['REFUND_REVERSED','REFUND']]]){
   for(const type of types)await refundNotification(env,notice(id,type,now-10000));
   assert.equal((await db.prepare('SELECT revoked_at FROM w2_apple_transactions WHERE transaction_id=?').bind(id).first()).revoked_at,now-11000);
  }
  assert.equal((await billingSummary(env,owners[0])).available,0);
 });
 await check('notification UUID replays must have identical facts and cannot mutate another transaction',async()=>{
  const event=notice('2006','REFUND',now-20000);
  await refundNotification(env,event);
  assert.equal((await refundNotification(env,{...event,notificationUUID:event.notificationUUID.toUpperCase()})).state,'refunded');
  for(const conflicting of [notice('2006','REFUND_REVERSED',now-10000,{notificationUUID:event.notificationUUID}),
   notice('2007','REFUND_REVERSED',now-10000,{notificationUUID:event.notificationUUID}),
   {...event,transaction:{...event.transaction,signedDate:now-10000}}])await reject(refundNotification(env,conflicting),409);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM w2_apple_transactions WHERE transaction_id='2007'").first()).n,0);
  assert.equal((await billingSummary(env,owners[0])).available,0);
 });
 await check('concurrent conflicting notification UUIDs commit only one event and one transaction',async()=>{
  const notificationUUID=crypto.randomUUID(),events=['2008','2009'].map(id=>notice(id,'REFUND',now-10000,{notificationUUID}));
  const results=await Promise.allSettled(events.map(event=>refundNotification(env,event)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM w2_apple_transactions WHERE transaction_id IN('2008','2009')").first()).n,1);
 });
 await check('notification validation rejects unsupported types, mismatched app or environment, and invalid signed times',async()=>{
  const base=notice('2010','REFUND');
  for(const extra of [{notificationType:'REFUND_DECLINED'},{notificationUUID:'invalid'},
   {signedDate:0},{signedDate:now+86400000},{environment:'Sandbox'},{bundleId:'another.app'},
   {transaction:undefined},{transaction:{...base.transaction,revocationDate:undefined}}]){
   await reject(refundNotification(env,{...base,...extra}),400);
  }
  const known=notice('2006','REFUND',now-5000,{}, {appAccountToken:accounts[1]});
  await reject(refundNotification(env,known),409);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM w2_apple_refund_notifications WHERE notification_id=?').bind(known.notificationUUID).first()).n,0);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM w2_apple_transactions WHERE transaction_id='2010'").first()).n,0);
 });
 await check('sandbox reversal cannot grant production credit or share production notification identity',async()=>{
  const event=notice('2011','REFUND_REVERSED',now-10000,{environment:'Sandbox'},{environment:'Sandbox'});
  await refundNotification(env,event);
  await refundNotification(env,notice('2011','REFUND',now,{notificationUUID:event.notificationUUID}));
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM w2_apple_refund_notifications WHERE notification_id=?').bind(event.notificationUUID).first()).n,2);
  assert.equal((await billingSummary(env,owners[0])).available,0);
 });
 await check('owner summary is private and another account cannot restore credits',async()=>{
  await record(env,facts('1004'));
  assert.equal((await request('billing/summary','GET',-1)).status,401);
  assert.deepEqual((await request('billing/summary','GET',1)).data,{available:0,refunded:0});
  assert.equal((await request('billing/summary','GET',0)).data.available,1);
 });
 await check('account deletion unlinks payment history and prevents old-token restoration',async()=>{
  assert.equal((await request('account/deletion','DELETE')).status,200);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM w2_billing_accounts WHERE owner_id=?').bind(owners[0]).first()).n,0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM w2_apple_transactions WHERE owner_id=?').bind(owners[0]).first()).n,0);
  await reject(record(env,facts('1004')),403);
  await record(env,facts('1004',{revocationDate:now-1000}));
  assert.equal((await refundNotification(env,notice('1004','REFUND_REVERSED',now+1000))).state,'unlinked');
  assert.equal((await db.prepare("SELECT owner_id FROM w2_apple_transactions WHERE transaction_id='1004'").first()).owner_id,null);
  assert.equal((await billingSummary(env,owners[0])).available,0);
  assert.equal((await request('billing/summary','GET')).status,401);
 });
 await check('reversal racing with account deletion records the event without reviving ownership',async()=>{
  const owner=crypto.randomUUID(),token=crypto.randomUUID();
  await db.prepare('INSERT INTO users VALUES(?,NULL,?)').bind(owner,new Date(now).toISOString()).run();
  await db.prepare('INSERT INTO w2_billing_accounts VALUES(?,?,?)').bind(owner,token,new Date(now).toISOString()).run();
  const original=env.DB;let fired=false;
  env.DB={batch:queries=>db.batch(queries),prepare(sql){
   const statement=db.prepare(sql);if(!sql.startsWith('SELECT b.owner_id'))return statement;
   return {bind(...values){const bound=statement.bind(...values);return {async first(){
    const value=await bound.first();
    if(!fired){fired=true;await db.batch([
     db.prepare("INSERT INTO w2_account_deletions VALUES(?,?,'pending',0)").bind(owner,new Date().toISOString()),
     db.prepare('DELETE FROM w2_billing_accounts WHERE owner_id=?').bind(owner)]);}
    return value;
   }}}};
  }};
  try{assert.equal((await refundNotification(env,notice('2012','REFUND_REVERSED',now,{}, {appAccountToken:token}))).state,'unlinked');assert.ok(fired);}
  finally{env.DB=original;}
  assert.equal((await billingSummary(env,owner)).available,0);
  // A subsequently reused token cannot attach an orphaned purchase to a new account.
  const otherOwner=crypto.randomUUID();
  await db.prepare('INSERT INTO users VALUES(?,NULL,?)').bind(otherOwner,new Date(now).toISOString()).run();
  await db.prepare('INSERT INTO w2_billing_accounts VALUES(?,?,?)').bind(otherOwner,token,new Date(now).toISOString()).run();
  await reject(record(env,facts('2012',{appAccountToken:token})),403);
  assert.equal((await db.prepare("SELECT owner_id FROM w2_apple_transactions WHERE transaction_id='2012'").first()).owner_id,null);
 });
 await check('deletion racing after ledger owner lookup cannot revive or attach a credit',async()=>{
  const original=env.DB;let fired=false;
  env.DB={batch:queries=>db.batch(queries),prepare(sql){
   const statement=db.prepare(sql);if(!sql.startsWith('SELECT b.owner_id'))return statement;
   return {bind(...values){
    const bound=statement.bind(...values);
    return {async first(){
     const value=await bound.first();
     if(!fired){fired=true;await db.batch([
      db.prepare("INSERT INTO w2_account_deletions VALUES(?,?,'pending',0)").bind(owners[1],new Date().toISOString()),
      db.prepare('DELETE FROM w2_billing_accounts WHERE owner_id=?').bind(owners[1])]);}
     return value;
    }};
   }};
  }};
  try{await reject(record(env,facts('1005',{appAccountToken:accounts[1]})),409);assert.ok(fired);}finally{env.DB=original;}
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM w2_apple_transactions WHERE transaction_id='1005'").first()).n,0);
 });
 const output={scope:'isolated D1; synthetic already-verified facts, no Apple cryptographic/provider/purchase proof',
  publicSalesEnabled:false,checks};
 await writeFile('docs/evidence/store-release-20261007/billing-ledger-local.json',JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify({passed:checks.length}));
}finally{await mf.dispose();}

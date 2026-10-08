import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import path from 'node:path';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolchain=process.env.OSAM_TOOLCHAIN??path.resolve(root,'../osam-rebuild/node_modules');
const {Miniflare,convertV4MiniflareOptions}=await import(pathToFileURL(path.join(toolchain,'miniflare/dist/src/index.js')).href);
const sharp=createRequire(pathToFileURL(path.join(toolchain,'placeholder.cjs')))('sharp');
const {default:worker,CAPACITY,quota,monthlyQuota}=await import('../cloudflare/build/replacement.mjs');
const origin='http://127.0.0.1:4180',secret='capacity-fixture-secret-not-for-production-32';
const mf=new Miniflare(convertV4MiniflareOptions({name:'free-capacity-fixture',modules:true,scriptPath:path.join(root,'cloudflare/build/replacement.mjs'),compatibilityDate:'2026-09-29',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'capacity-fixture'},r2Buckets:['MEDIA']}));
const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('MEDIA');
let transforms=0,puts=0,gets=0;
const env={DB:db,ABUSE_HMAC_SECRET:secret,NEXT_PUBLIC_SITE_URL:origin,MEDIA:{
 async put(...args){puts++;return bucket.put(...args);},
 async get(...args){gets++;return bucket.get(...args);},
 delete:(...args)=>bucket.delete(...args),
},IMAGES:{
 async info(stream){const meta=await sharp(Buffer.from(await new Response(stream).arrayBuffer())).metadata();return {width:meta.width,height:meta.height,format:meta.format};},
 input(stream){return {transform(){return {async output(){transforms++;const data=await sharp(Buffer.from(await new Response(stream).arrayBuffer())).rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();return {response:()=>new Response(data,{headers:{'Content-Type':'image/webp'}})};}};}};}
}};
const checks=[],users=[],tokens=[],urls=[];
const now=new Date(),month=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)/1000,nextMonth=Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)/1000;
const digest=async value=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');
const image=await sharp({create:{width:32,height:32,channels:3,background:'#dacabb'}}).jpeg().toBuffer();
async function check(name,fn){await fn();checks.push({name,result:'PASS'});console.log('PASS',name);}
async function upload(owner,key=crypto.randomUUID(),binding=env){
 const response=await worker.fetch(new Request(origin+'/api/v2/uploads',{method:'POST',headers:{cookie:`__Host-osam-session=${tokens[owner]}`,origin,'content-type':'image/jpeg','idempotency-key':key,'cf-connecting-ip':'192.0.2.1'},body:image}),binding);
 return {status:response.status,data:await response.json()};
}
async function setMonth(scope,action,hits){await db.prepare('INSERT INTO w2_limits VALUES(?,?,?,?,?) ON CONFLICT(scope,action,window) DO UPDATE SET hits=excluded.hits').bind(scope,action,month,hits,nextMonth).run();}
async function photoFixture(owner,bytes,state='ready'){
 const id=crypto.randomUUID();await db.prepare('INSERT INTO w2_photos VALUES(?,?,?,?,?,?,?,?)').bind(id,users[owner],`w2/fixture/${id}.webp`,bytes,state,crypto.randomUUID(),'fixture',new Date().toISOString()).run();return id;
}
try{
 await db.exec('CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,created_at TEXT);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),created_at TEXT,expires_at TEXT);CREATE TABLE deletion_jobs(id TEXT PRIMARY KEY,owner_id TEXT,state TEXT);');
 for(const name of ['0005_replacement.sql','0006_service_accounts.sql','0007_operator_review.sql','0008_billing_ledger.sql','0009_billing_refund_notifications.sql']){
  const text=(await readFile(path.join(root,'cloudflare/migrations',name),'utf8')).replace(/^--.*$/gm,'');
  for(const sql of text.split(';').filter(value=>value.trim()))await db.prepare(sql).run();
 }
 await db.prepare("UPDATE w2_controls SET enabled=1 WHERE name='uploads'").run();
 for(let index=0;index<100;index++){
  users.push(crypto.randomUUID());tokens.push(crypto.randomUUID().replaceAll('-','')+'0123456789abcdef');
  await db.batch([db.prepare('INSERT INTO users VALUES(?,NULL,?)').bind(users[index],new Date().toISOString()),db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').bind(await digest(tokens[index]),users[index],new Date().toISOString(),new Date(Date.now()+86400000).toISOString())]);
 }
 await check('100 creators can each upload 31 decoded photos through the Worker',async()=>{
  for(let owner=0;owner<100;owner++){
   for(let start=0;start<31;start+=8){
    const results=await Promise.all(Array.from({length:Math.min(8,31-start)},()=>upload(owner)));
    for(const result of results){assert.equal(result.status,201,JSON.stringify(result.data));urls.push(result.data.url);}
   }
   if((owner+1)%10===0)console.log(`COHORT ${owner+1}/100 creators`);
  }
  assert.equal((await db.prepare("SELECT count(*) AS n FROM w2_photos WHERE state='ready'").first()).n,3100);
  assert.equal(transforms,3100);assert.equal(puts,3100);
  assert.equal((await db.prepare("SELECT hits FROM w2_limits WHERE scope='global' AND action='image-transform-month'").first()).hits,3100);
 });
 await check('retrying one photo does not consume another provider reservation',async()=>{
  const key=crypto.randomUUID(),first=await upload(0,key),before=transforms,writes=puts;
  assert.equal(first.status,201);const retry=await upload(0,key);assert.equal(retry.status,200);assert.deepEqual(retry.data,first.data);assert.equal(transforms,before);assert.equal(puts,writes);
 });
 await check('one creator cannot exhaust the shared image budget',async()=>{
  await setMonth(users[0],'image-transform-month',150);const before=transforms;
  assert.equal((await upload(0)).status,429);assert.equal(transforms,before);
  assert.equal((await upload(1)).status,201);
 });
 await check('monthly counters use UTC calendar boundaries and ignore the old month',async()=>{
  const oldMonth=Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,1)/1000;
  await db.prepare('INSERT INTO w2_limits VALUES(?,?,?,?,?)').bind('calendar','check',oldMonth,999,month).run();
  await monthlyQuota(env,'calendar','check',2);
  const row=await db.prepare('SELECT * FROM w2_limits WHERE scope=? AND window=?').bind('calendar',month).first();
  assert.equal(row.hits,1);assert.equal(row.expires_at,nextMonth);
 });
 await check('oversized first reservation and invalid counter arguments fail closed',async()=>{
  await assert.rejects(()=>monthlyQuota(env,'oversize','check',1,2),error=>error.status===429);
  assert.equal(await db.prepare('SELECT * FROM w2_limits WHERE scope=?').bind('oversize').first(),null);
  for(const amount of [0,-1,1.1,NaN])await assert.rejects(()=>quota(env,'invalid','check',10,60,amount),error=>error.status===503);
  await assert.rejects(()=>quota(env,'invalid','check',10,0),error=>error.status===503);
 });
 await check('concurrent uploads cannot spend the final image transform twice',async()=>{
  await setMonth('global','image-transform-month',4999);const before=transforms;
  const results=await Promise.all([upload(2),upload(3)]);
  assert.deepEqual(results.map(value=>value.status).sort(),[201,429]);assert.equal(transforms,before+1);
  await setMonth('global','image-transform-month',3103);
 });
 await check('failed provider transform keeps its monthly reservation',async()=>{
  const before=(await db.prepare("SELECT hits FROM w2_limits WHERE scope='global' AND action='image-transform-month'").first()).hits;
  const failed={...env,IMAGES:{...env.IMAGES,input(){return {transform(){return {output:async()=>({response:()=>new Response('fixture outage',{status:503})})};}};}}};
  assert.equal((await upload(4,crypto.randomUUID(),failed)).status,503);
  assert.equal((await db.prepare("SELECT hits FROM w2_limits WHERE scope='global' AND action='image-transform-month'").first()).hits,before+1);
 });
 await check('a monthly R2 read limit stops access before the provider call',async()=>{
  await setMonth('global','r2-read-month',10_000_000);const before=gets;
  const response=await worker.fetch(new Request(origin+urls[0],{headers:{cookie:`__Host-osam-session=${tokens[0]}`,'cf-connecting-ip':'192.0.2.1'}}),env);
  assert.equal(response.status,429);assert.equal(gets,before);
 });
 await check('100 full owner allocations fit; the next byte reservation is denied',async()=>{
  // Synthetic byte counters prove admission arithmetic, not 10 GB of real provider storage.
  await db.prepare('DELETE FROM w2_photo_activity').run();await db.prepare('DELETE FROM w2_photos').run();
  const reserved=1572864;
  for(let owner=0;owner<100;owner++)await photoFixture(owner,owner===99?100_000_000-reserved:100_000_000);
  assert.equal(CAPACITY.servicePhotoBytes,10_000_000_000);const before=transforms;
  assert.equal((await upload(99)).status,201);assert.equal(transforms,before+1);
  await db.prepare('DELETE FROM w2_photos WHERE owner_id=?').bind(users[99]).run();await photoFixture(99,100_000_000);
  const full=transforms;assert.equal((await upload(99)).status,429);assert.equal(transforms,full);
 });
 await check('full per-owner storage blocks only that owner before transformation',async()=>{
  await db.prepare('DELETE FROM w2_photos').run();await photoFixture(5,100_000_000);
  const before=transforms;assert.equal((await upload(5)).status,429);assert.equal(transforms,before);
  assert.equal((await upload(6)).status,201);
 });
 await check('eight reserved upload slots prevent a ninth provider operation',async()=>{
  await db.prepare('DELETE FROM w2_photos').run();for(let index=0;index<8;index++)await photoFixture(index,1572864,'uploading');
  const before=transforms;assert.equal((await upload(7)).status,429);assert.equal(transforms,before);
 });
 await check('free configuration keeps billing disabled',async()=>{
  const response=await worker.fetch(new Request(origin+'/api/v2/account/config',{headers:{'cf-connecting-ip':'192.0.2.1'}}),env);
  assert.equal(response.status,200);assert.equal((await response.json()).billingEnabled,false);
 });
 const directory=path.join(root,'docs/evidence/free-release-20261008');await mkdir(directory,{recursive:true});
 await writeFile(path.join(directory,'capacity-local.json'),JSON.stringify({date:new Date().toISOString(),lane:'Local Miniflare D1/R2; real sharp decode and resize; not a throughput test or production/provider-billing proof',creators:100,photosPerCreator:31,cohortPhotos:3100,syntheticStorageAllocationBytes:10_000_000_000,checks},null,2)+'\n');
 console.log(`${checks.length} capacity groups passed`);
}finally{await mf.dispose();}

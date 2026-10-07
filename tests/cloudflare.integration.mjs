import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const toolchain=process.env.OSAM_TOOLCHAIN??path.resolve(root,'../osam-rebuild/node_modules');
const {Miniflare,convertV4MiniflareOptions}=await import(pathToFileURL(path.join(toolchain,'miniflare/dist/src/index.js')).href);
const sharp=createRequire(pathToFileURL(path.join(toolchain,'placeholder.cjs')))('sharp');
const {default:worker,cleanup,loginReturn}=await import('../cloudflare/build/replacement.mjs');
const origin='http://127.0.0.1:4180',secret='local-fixture-hmac-key-32-characters-never-used-remotely';
const mime=p=>p.endsWith('.webp')?'image/webp':'text/html; charset=utf-8';
async function assets(request){const p=new URL(request.url).pathname;const file=p==='/replacement/index.html'?path.join(root,'dist-cloudflare/index.html'):path.join(root,'public',p);if(!file.startsWith(root+'/'))return new Response('Forbidden',{status:403});try{return new Response(await readFile(file),{headers:{'Content-Type':mime(p)}});}catch{return new Response('Not found',{status:404});}}
const mf=new Miniflare(convertV4MiniflareOptions({name:"fixture",modules:true,scriptPath:path.join(root,'cloudflare/build/replacement.mjs'),compatibilityDate:'2026-09-29',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'local-test-db'},r2Buckets:['MEDIA'],bindings:{ABUSE_HMAC_SECRET:secret,NEXT_PUBLIC_SITE_URL:origin},serviceBindings:{ASSETS:assets}}));
const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('MEDIA');
const env={DB:db,MEDIA:bucket,ABUSE_HMAC_SECRET:secret,NEXT_PUBLIC_SITE_URL:origin,ASSETS:{fetch:assets},IMAGES:{
 async info(stream){const meta=await sharp(Buffer.from(await new Response(stream).arrayBuffer())).metadata();return {width:meta.width,height:meta.height,format:meta.format};},
 input(stream){return {transform(){return {async output(){const output=await sharp(Buffer.from(await new Response(stream).arrayBuffer())).rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();return {response:()=>new Response(output,{headers:{'Content-Type':'image/webp'}})};}};}};}
}};
const checks=[];
async function check(name,fn){await fn();checks.push({name,result:'PASS'});console.log('PASS',name);}
const digest=s=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(a=>Buffer.from(a).toString('hex'));
const users=[crypto.randomUUID(),crypto.randomUUID()],tokens=[crypto.randomUUID().replaceAll('-','')+'0123456789abcdef',crypto.randomUUID().replaceAll('-','')+'0123456789abcdef'];
async function request(p,method='GET',body,who=-1,options={}){
 const headers={'cf-connecting-ip':options.ip??'192.0.2.1',...(who>=0?{cookie:`__Host-osam-session=${tokens[who]}`}:{})};
 if(method!=='GET'&&method!=='HEAD')Object.assign(headers,{'content-type':'application/json',origin,'idempotency-key':options.key??crypto.randomUUID()});
 Object.assign(headers,options.headers??{});
 const req=new Request(origin+p,{method,headers,body:body===undefined?undefined:body instanceof Uint8Array?body:JSON.stringify(body)});
 const res=options.runtime?await mf.dispatchFetch(req.url,{method:req.method,headers:Object.fromEntries(req.headers)}):await worker.fetch(req,options.env??env);
 return {status:res.status,data:res.headers.get('content-type')?.includes('json')?await res.json():await res.text(),headers:res.headers};
}
try{
 await db.exec('CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,created_at TEXT);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),created_at TEXT,expires_at TEXT);CREATE TABLE deletion_jobs(id TEXT PRIMARY KEY,owner_id TEXT,state TEXT);');
 const migration=(await readFile(path.join(root,'cloudflare/migrations/0005_replacement.sql'),'utf8')).replace(/^--.*$/gm,'');
 for(const sql of migration.split(';').filter(s=>s.trim()))await db.prepare(sql).run();
 for(let i=0;i<2;i++){await db.prepare('INSERT INTO users VALUES(?,NULL,?)').bind(users[i],new Date().toISOString()).run();await db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').bind(await digest(tokens[i]),users[i],new Date().toISOString(),new Date(Date.now()+86400000).toISOString()).run();}
 const sample={slug:'cf-check-one',type:'wedding',templateId:'blossom',dateTime:new Date(Date.now()+30*86400000).toISOString().slice(0,16),wedding:{groom:{name:'점검신랑',order:'아들'},bride:{name:'점검신부',order:'딸'}},venue:{name:'점검홀',address:'점검주소',lat:37.5,lng:127},greetingTitle:'초대합니다',greeting:'검증용 합성 내용',coverPhoto:'/photos/wedding-spring.webp',gallery:[],accounts:[{id:'fixture-account',side:'groom',label:'합성계좌',bank:'점검은행',number:'NOT-A-REAL-ACCOUNT',holder:'합성'}],options:{showCalendar:true,showDday:true,showGallery:true,showAccounts:false,showGuestbook:true,showRsvp:true,showEffect:false},shareTitle:'검증용 청첩장',shareDescription:'합성 점검'};
 // Choose a known asset from the real template source, without accepting arbitrary paths.
 const photos=await readFile(path.join(root,'src/data/photos.generated.ts'),'utf8');sample.coverPhoto=photos.match(/\/[a-z]+\/[a-z0-9-]+\.webp/)[0];
 await check('anonymous listing requires login',async()=>assert.equal((await request('/api/v2/invitations')).status,401));
 const saveKey=crypto.randomUUID();let inv;
 await check('owner saves D1 draft',async()=>{const r=await request('/api/v2/invitations/'+sample.slug,'PUT',sample,0,{key:saveKey});assert.equal(r.status,201);inv=r.data;assert.equal(inv.revision,1);});
 await check('save retry returns original result',async()=>{const r=await request('/api/v2/invitations/'+sample.slug,'PUT',sample,0,{key:saveKey});assert.equal(r.status,200);assert.equal(r.data.revision,1);});
 await check('idempotency key rejects different content',async()=>assert.equal((await request('/api/v2/invitations/'+sample.slug,'PUT',{...sample,greeting:'different'},0,{key:saveKey})).status,409));
 await check('anonymous and second owner cannot read draft',async()=>{assert.equal((await request('/api/v2/invitations/'+sample.slug)).status,404);assert.equal((await request('/api/v2/invitations/'+sample.slug,'GET',undefined,1)).status,404);});
 await check('other account cannot overwrite draft',async()=>assert.equal((await request('/api/v2/invitations/'+sample.slug,'PUT',inv,1)).status,409));
 await check('stale revision cannot overwrite draft',async()=>assert.equal((await request('/api/v2/invitations/'+sample.slug,'PUT',sample,0)).status,409));
 await check('AI examples cannot be published',async()=>assert.equal((await request('/api/v2/invitations/'+sample.slug+'/publish','POST',{published:true,revision:1},0)).status,400));
 await check('CSRF rejects foreign origin',async()=>assert.equal((await request('/api/v2/invitations/'+sample.slug,'PUT',inv,0,{headers:{origin:'https://evil.example'}})).status,403));
 await check('missing slug returns 404 without login',async()=>assert.equal((await request('/api/v2/invitations/missing-entry')).status,404));
 await check('upload kill switch blocks before image processing',async()=>assert.equal((await request('/api/v2/uploads','POST',new Uint8Array([1]),0,{headers:{'content-type':'image/jpeg'}})).status,503));
 await db.prepare("UPDATE w2_controls SET enabled=1 WHERE name='uploads'").run();
 const image=await sharp({create:{width:90,height:120,channels:3,background:'#cfaaab'}}).jpeg().toBuffer();
 let uploaded;
 const uploadKey=crypto.randomUUID();
 await check('real image decode and R2 upload',async()=>{const r=await request('/api/v2/uploads','POST',image,0,{key:uploadKey,headers:{'content-type':'image/jpeg'}});assert.equal(r.status,201);uploaded=r.data.url;assert.match(uploaded,/^\/api\/photos\//);});
 await check('upload retry consumes no second transform',async()=>{const before=await db.prepare("SELECT hits FROM w2_limits WHERE action='image-transform'").first();assert.equal((await request('/api/v2/uploads','POST',image,0,{key:uploadKey,headers:{'content-type':'image/jpeg'}})).status,200);assert.deepEqual(await db.prepare("SELECT hits FROM w2_limits WHERE action='image-transform'").first(),before);});
 await check('unreferenced private image is inaccessible to guests',async()=>assert.equal((await request(uploaded)).status,404));
 await check('photo reads work in actual workerd runtime',async()=>assert.equal((await request(uploaded,'GET',undefined,0,{runtime:true})).status,200));
 await check('another owner cannot use an uploaded photo',async()=>assert.equal((await request('/api/v2/invitations/cf-other','PUT',{...sample,slug:'cf-other',coverPhoto:uploaded},1)).status,403));
 await check('owner saves real image',async()=>{const r=await request('/api/v2/invitations/'+sample.slug,'PUT',{...inv,coverPhoto:uploaded,coverPresentation:{x:.3,y:.7,zoom:1.4,fit:'cover'},options:{...inv.options,font:'gowun-dodum'}},0);assert.equal(r.status,200);inv=r.data;assert.equal(inv.revision,2);});
 await check('explicit publication is stored separately',async()=>assert.equal((await request('/api/v2/invitations/'+sample.slug+'/publish','POST',{published:true,revision:2},0)).status,200));
 await check('published page and stable OG photo are public',async()=>{const r=await request('/i/'+sample.slug);assert.equal(r.status,200);assert.match(r.data,/<meta property="og:image"/);assert.ok(r.data.includes(uploaded));const p=await request(uploaded);assert.equal(p.status,200);assert.equal(p.headers.get('cache-control'),'private, no-store');});
 await check('crop and font persist in D1 draft and public snapshot',async()=>{const owner=(await request('/api/v2/invitations/'+sample.slug,'GET',undefined,0)).data;const pub=(await request('/api/v2/invitations/'+sample.slug)).data;assert.deepEqual(owner.coverPresentation,{x:.3,y:.7,zoom:1.4,fit:'cover'});assert.deepEqual(pub.coverPresentation,owner.coverPresentation);assert.equal(pub.options.font,'gowun-dodum');});
 await check('hidden bank accounts are excluded from the public DTO',async()=>{assert.equal((await request('/api/v2/invitations/'+sample.slug)).data.accounts.length,0);assert.equal((await request('/api/v2/invitations/'+sample.slug,'GET',undefined,0)).data.accounts.length,1);});
 await check('editing draft does not change public snapshot',async()=>{inv=(await request('/api/v2/invitations/'+sample.slug,'PUT',{...inv,greeting:'수정한 초안',coverPresentation:{x:.5,y:.5,zoom:1,fit:'contain'},options:{...inv.options,font:'pretendard'}},0)).data;assert.equal((await request('/api/v2/invitations/'+sample.slug)).data.greeting,sample.greeting);const pub=(await request('/api/v2/invitations/'+sample.slug)).data;assert.equal(pub.options.font,'gowun-dodum');assert.equal(pub.coverPresentation.fit,'cover');assert.equal(inv.options.font,'pretendard');});
 const rsvpKey=crypto.randomUUID(),rsvp={side:'groom',name:'합성하객',attending:true,count:2,meal:'yes',memo:''};
 await check('guest RSVP is stored once',async()=>{assert.equal((await request('/api/v2/invitations/'+sample.slug+'/rsvp','POST',rsvp,-1,{key:rsvpKey})).status,201);assert.equal((await request('/api/v2/invitations/'+sample.slug+'/rsvp','POST',rsvp,-1,{key:rsvpKey})).status,200);assert.equal((await request('/api/v2/invitations/'+sample.slug+'/rsvp','GET',undefined,0)).data.length,1);});
 await check('RSVP list is owner-only',async()=>{assert.equal((await request('/api/v2/invitations/'+sample.slug+'/rsvp')).status,404);assert.equal((await request('/api/v2/invitations/'+sample.slug+'/rsvp','GET',undefined,1)).status,404);});
 let entry;
 await check('guestbook waits for owner approval',async()=>{entry=(await request('/api/v2/invitations/'+sample.slug+'/guestbook','POST',{name:'합성하객',message:'축하합니다',password:'safe-pass-123'})).data;assert.equal((await request('/api/v2/invitations/'+sample.slug+'/guestbook')).data.length,0);});
 await check('owner approves then hides guestbook',async()=>{assert.equal((await request('/api/v2/invitations/'+sample.slug+'/moderation','PATCH',{id:entry.id,approved:true},0)).status,200);assert.equal((await request('/api/v2/invitations/'+sample.slug+'/guestbook')).data.length,1);assert.equal((await request('/api/v2/invitations/'+sample.slug+'/moderation','PATCH',{id:entry.id,approved:false},0)).status,200);assert.equal((await request('/api/v2/invitations/'+sample.slug+'/guestbook')).data.length,0);});
 await check('passwords and raw fingerprints are absent from stored operations',async()=>{const rows=(await db.prepare('SELECT * FROM w2_operations').all()).results;assert.ok(!JSON.stringify(rows).includes('safe-pass-123'));assert.ok(!JSON.stringify(rows).includes('192.0.2.1'));});
 await check('guestbook wrong password rejected, correct password deletes',async()=>{assert.equal((await request('/api/v2/invitations/'+sample.slug+'/guestbook/'+entry.id,'DELETE',{password:'wrong'})).status,403);assert.equal((await request('/api/v2/invitations/'+sample.slug+'/guestbook/'+entry.id,'DELETE',{password:'safe-pass-123'})).status,200);});
 await check('more than 21 normal photo reads stay available',async()=>{for(let i=0;i<25;i++)assert.equal((await request(uploaded)).status,200);});
 await check('verified clients have independent quotas',async()=>{const key=Buffer.from(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),new TextEncoder().encode(`ip:${Math.floor(Date.now()/86400000)}:192.0.2.21`))).toString('hex');await db.prepare('INSERT INTO w2_limits VALUES(?,?,?,?,?)').bind(key,'read',Math.floor(Date.now()/60000)*60,300,Math.floor(Date.now()/1000)+60).run();assert.equal((await request(uploaded,'GET',undefined,-1,{ip:'192.0.2.21'})).status,429);assert.equal((await request(uploaded,'GET',undefined,-1,{ip:'192.0.2.22'})).status,200);});
 await check('unpublish revokes page and photo immediately',async()=>{assert.equal((await request('/api/v2/invitations/'+sample.slug+'/publish','POST',{published:false,revision:3},0)).status,200);assert.equal((await request(uploaded)).status,404);assert.equal((await request('/i/'+sample.slug)).status,404);});
 await check('concurrent saves accept exactly one revision',async()=>{const results=await Promise.all(['one','two'].map(greeting=>request('/api/v2/invitations/'+sample.slug,'PUT',{...inv,greeting},0)));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);inv=(await request('/api/v2/invitations/'+sample.slug,'GET',undefined,0)).data;});
 await check('publication expiry is independent of draft edits',async()=>{assert.equal((await request('/api/v2/invitations/'+sample.slug+'/publish','POST',{published:true,revision:inv.revision},0)).status,200);await db.prepare('UPDATE w2_invitations SET public_expires_at=? WHERE slug=?').bind(new Date(Date.now()-1000).toISOString(),sample.slug).run();assert.equal((await request('/api/v2/invitations/'+sample.slug)).status,404);assert.equal((await request('/api/v2/invitations/'+sample.slug,'GET',undefined,0)).status,200);await cleanup(env);assert.equal((await request('/api/v2/invitations/'+sample.slug,'GET',undefined,0)).data.published,false);});
 await check('live storage cap rejects upload before transformation',async()=>{const id=crypto.randomUUID();await db.prepare("INSERT INTO w2_photos VALUES(?,?,?,?, 'ready',?,?,?)").bind(id,users[1],'w2/full-fixture.webp',1000000000,crypto.randomUUID(),'fixture',new Date().toISOString()).run();const before=(await db.prepare("SELECT hits FROM w2_limits WHERE action='image-transform'").first()).hits;assert.equal((await request('/api/v2/uploads','POST',image,0,{headers:{'content-type':'image/jpeg'}})).status,429);assert.equal((await db.prepare("SELECT hits FROM w2_limits WHERE action='image-transform'").first()).hits,before);await db.prepare('DELETE FROM w2_photos WHERE id=?').bind(id).run();});
 await check('invalid image bytes are rejected by a real decoder',async()=>assert.equal((await request('/api/v2/uploads','POST',new Uint8Array([1,2,3]),0,{headers:{'content-type':'image/jpeg'}})).status,400));
 await check('storage deletion refunds live byte usage',async()=>{const before=(await db.prepare('SELECT SUM(bytes) AS n FROM w2_photos').first()).n;inv=(await request('/api/v2/invitations/'+sample.slug,'PUT',{...inv,coverPhoto:sample.coverPhoto},0)).data;assert.equal((await request(uploaded,'DELETE',{},0)).status,200);assert.equal((await db.prepare('SELECT COALESCE(SUM(bytes),0) AS n FROM w2_photos').first()).n,0);assert.ok(before>0);});
 await check('invitation deletion queues only unused photos and refunds after cleanup',async()=>{const photo=(await request('/api/v2/uploads','POST',image,0,{headers:{'content-type':'image/jpeg'}})).data.url;const draft={...sample,slug:'delete-check',coverPhoto:photo};assert.equal((await request('/api/v2/invitations/delete-check','PUT',draft,0)).status,201);assert.equal((await request('/api/v2/invitations/delete-check','DELETE',{},0)).status,200);assert.equal((await request(photo,'GET',undefined,0)).status,404);assert.ok((await db.prepare('SELECT SUM(bytes) AS n FROM w2_photos').first()).n>0);await cleanup(env);assert.equal((await db.prepare('SELECT COALESCE(SUM(bytes),0) AS n FROM w2_photos').first()).n,0);});
 await check('provider failure retains a deletion reservation for retry',async()=>{const id=crypto.randomUUID();await db.prepare("INSERT INTO w2_photos VALUES(?,?,?,?, 'deleting',?,?,?)").bind(id,users[0],'w2/failing.webp',100,crypto.randomUUID(),'fixture',new Date().toISOString()).run();await cleanup({...env,MEDIA:{...bucket,delete:async()=>{throw new Error('simulated R2 outage');}}}).catch(()=>{});assert.equal((await db.prepare('SELECT bytes FROM w2_photos WHERE id=?').bind(id).first()).bytes,100);await cleanup(env);assert.equal(await db.prepare('SELECT id FROM w2_photos WHERE id=?').bind(id).first(),null);});
 await check('quota/database outage returns controlled 503',async()=>{const r=await request('/api/v2/invitations/'+sample.slug,'GET',undefined,-1,{env:{...env,DB:{prepare(){throw new Error('fixture outage');}}}});assert.equal(r.status,503);assert.ok(!JSON.stringify(r.data).includes('fixture outage'));});
 await check('OAuth return preserves native callback and cookies',async()=>{const req=new Request(origin+'/auth/google/callback',{headers:{cookie:'__Host-w2-return=%2Fmy'}}),res=new Response(null,{status:302,headers:{location:'https://osamosam-app.jyb1126.chatgpt.site/dashboard?import=1','Set-Cookie':'__Host-osam-session=fixture; Secure; HttpOnly; Path=/'}});const out=loginReturn(req,res);assert.equal(out.headers.get('location'),'https://osamosam-app.jyb1126.chatgpt.site/my');assert.ok(out.headers.get('set-cookie').includes('__Host-osam-session'));assert.equal(loginReturn(req,new Response(null,{status:302,headers:{location:'com.invitehub.app://auth?code=fixture'}})).headers.get('location'),'com.invitehub.app://auth?code=fixture');});
 await check('reserved slug deletion preserves other owner operations',async()=>{
  const slug='draft',prefix=users[0]+':'+slug+':',other=users[1]+':other:draft:PUT:',guest='guest:'+('a'.repeat(64))+':'+slug+':rsvp:POST:';
  assert.equal((await request('/api/v2/invitations/'+slug,'PUT',{...sample,slug},0)).status,201);
  for(const scope of [other,guest])await db.prepare('INSERT INTO w2_operations VALUES(?,?,?,?,?,?)').bind(scope,crypto.randomUUID(),'fixture','fixture','{}',Date.now()+60000).run();
  assert.equal((await request('/api/v2/invitations/'+slug,'DELETE',{},0)).status,200);
  assert.ok(await db.prepare('SELECT id FROM w2_operations WHERE scope=?').bind(other).first());
  assert.equal(await db.prepare('SELECT id FROM w2_operations WHERE scope=?').bind(guest).first(),null);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM w2_operations WHERE substr(scope,1,?)=?').bind(prefix.length,prefix).first()).n,1); // This DELETE's replay result remains.
 });
 await check('stale uploading rows do not lock all upload slots',async()=>{
  const ids=Array.from({length:4},()=>crypto.randomUUID());
  for(const id of ids)await db.prepare("INSERT INTO w2_photos VALUES(?,?,?,?, 'uploading',?,?,?)").bind(id,users[0],'w2/'+id+'.webp',100,crypto.randomUUID(),'fixture',new Date(Date.now()-20*60000).toISOString()).run();
  const r=await request('/api/v2/uploads','POST',image,0,{headers:{'content-type':'image/jpeg'}});assert.equal(r.status,201);
  await cleanup(env);for(const id of ids)assert.equal(await db.prepare('SELECT id FROM w2_photos WHERE id=?').bind(id).first(),null);
  assert.equal((await request(r.data.url,'DELETE',{},0)).status,200);
 });
 await check('four active uploads stop a fifth before transform',async()=>{
  const ids=Array.from({length:4},()=>crypto.randomUUID());
  for(const id of ids)await db.prepare("INSERT INTO w2_photos VALUES(?,?,?,?, 'uploading',?,?,?)").bind(id,users[0],'w2/'+id+'.webp',100,crypto.randomUUID(),'fixture',new Date().toISOString()).run();
  const before=(await db.prepare("SELECT hits FROM w2_limits WHERE action='image-transform'").first()).hits;
  assert.equal((await request('/api/v2/uploads','POST',image,0,{headers:{'content-type':'image/jpeg'}})).status,429);
  assert.equal((await db.prepare("SELECT hits FROM w2_limits WHERE action='image-transform'").first()).hits,before);
  for(const id of ids)await db.prepare('DELETE FROM w2_photos WHERE id=?').bind(id).run();
 });
 await check('cleanup isolates a failed object and continues to the next',async()=>{
  const ids=[crypto.randomUUID(),crypto.randomUUID()];
  for(const [i,id] of ids.entries())await db.prepare("INSERT INTO w2_photos VALUES(?,?,?,?, 'deleting',?,?,?)").bind(id,users[0],'w2/cleanup-'+i+'.webp',100,crypto.randomUUID(),'fixture',new Date().toISOString()).run();
  await cleanup({...env,MEDIA:{delete:async key=>{if(key==='w2/cleanup-0.webp')throw new Error('simulated R2 outage');await bucket.delete(key);}}});
  assert.equal((await db.prepare('SELECT bytes FROM w2_photos WHERE id=?').bind(ids[0]).first()).bytes,100);
  assert.equal(await db.prepare('SELECT id FROM w2_photos WHERE id=?').bind(ids[1]).first(),null);await cleanup(env);
 });
 await check('JSON byte cap rejects excess input',async()=>assert.equal((await request('/api/v2/auth/logout','POST',{value:'x'.repeat(65536)})).status,413));
 await check('aborted request releases body and returns 408',async()=>{
  let cancelled=false;const controller=new AbortController(),body=new ReadableStream({cancel(){cancelled=true;}});
  const req=new Request(origin+'/api/v2/auth/logout',{method:'POST',headers:{origin,'content-type':'application/json','idempotency-key':crypto.randomUUID()},body,duplex:'half',signal:controller.signal});
  const pending=worker.fetch(req,env);setTimeout(()=>controller.abort(),30);const res=await pending;assert.equal(res.status,408);assert.equal(cancelled,true);assert.equal(body.locked,false);
 });
 await check('JSON receive deadline is total and cancels a slow stream',async()=>{
  let cancelled=false,timer;const body=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));timer=setTimeout(()=>c.enqueue(new TextEncoder().encode('"x":')),8000);},cancel(){cancelled=true;clearTimeout(timer);}});
  const req=new Request(origin+'/api/v2/auth/logout',{method:'POST',headers:{origin,'content-type':'application/json','idempotency-key':crypto.randomUUID()},body,duplex:'half'}),started=Date.now();
  const res=await worker.fetch(req,env);assert.equal(res.status,408);assert.ok(Date.now()-started<18000,'Chunks must not restart the 15-second deadline');assert.equal(cancelled,true);assert.equal(body.locked,false);
 });
 await check('anonymous or expired logout clears cookie and preserves CSRF',async()=>{
  for(const who of [-1,0]){if(who===0)await db.prepare('UPDATE sessions SET expires_at=? WHERE user_id=?').bind(new Date(Date.now()-1000).toISOString(),users[0]).run();const r=await request('/api/v2/auth/logout','POST',{},who);assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);}
  assert.equal((await request('/api/v2/auth/logout','POST',{},-1,{headers:{origin:'https://evil.example'}})).status,403);
  await db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').bind(await digest(tokens[0]),users[0],new Date().toISOString(),new Date(Date.now()+86400000).toISOString()).run();
 });
 await check('account deletion revokes v2 public data before cleanup',async()=>{const slug='draft',guest='guest:'+('b'.repeat(64))+':draft:rsvp:POST:',other=users[1]+':other:draft:PUT:';assert.equal((await request('/api/v2/invitations/'+slug,'PUT',{...sample,slug},0)).status,201);await db.prepare('INSERT INTO w2_operations VALUES(?,?,?,?,?,?)').bind(guest,crypto.randomUUID(),'fixture','fixture','{}',Date.now()+60000).run();await db.prepare('INSERT INTO deletion_jobs VALUES(?,?,?)').bind(crypto.randomUUID(),users[0],'pending').run();assert.equal((await request('/api/v2/invitations/'+sample.slug,'GET',undefined,0)).status,404);assert.equal((await request('/api/v2/invitations','GET',undefined,0)).status,401);await cleanup(env);assert.equal(await db.prepare('SELECT slug FROM w2_invitations WHERE owner_id=?').bind(users[0]).first(),null);assert.equal(await db.prepare('SELECT id FROM w2_operations WHERE scope LIKE ?').bind(users[0]+':%').first(),null);assert.equal(await db.prepare('SELECT id FROM w2_operations WHERE scope=?').bind(guest).first(),null);assert.ok(await db.prepare('SELECT id FROM w2_operations WHERE scope=?').bind(other).first());await db.prepare('DELETE FROM deletion_jobs WHERE owner_id=?').bind(users[0]).run();});
 await mkdir(path.join(root,'docs/evidence'),{recursive:true});await writeFile(process.env.WEDDING_EVIDENCE_DIR?path.join(root,process.env.WEDDING_EVIDENCE_DIR,'cloudflare-local.json'):path.join(root,'docs/evidence/cloudflare-local-20261003.json'),JSON.stringify({date:new Date().toISOString(),lane:'Miniflare D1/R2, real local sharp image decode; actual workerd photo request; Cloudflare Images requires separate production verification',checks},null,2)+'\n');
 console.log(`${checks.length} checks passed`);
 if(process.argv.includes('--serve')){
  const {createServer}=await import('node:http');const server=createServer(async(req,res)=>{
   if(req.url==='/__fixture/login'){res.writeHead(302,{'Set-Cookie':`__Host-osam-session=${tokens[1]}; Path=/; HttpOnly; Secure; SameSite=Lax`,'Location':'/my'});res.end();return;}
   const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks),headers=new Headers(req.headers);headers.set('cf-connecting-ip','192.0.2.100');
   let output;try{output=await worker.fetch(new Request(origin+req.url,{method:req.method,headers,...(body.length?{body,duplex:'half'}:{})}),env);}catch{output=new Response('Fixture failed',{status:500});}
   if(output.status===404&&!req.url.startsWith('/api/'))output=await assets(new Request(origin+req.url));
   res.writeHead(output.status,Object.fromEntries(output.headers));res.end(Buffer.from(await output.arrayBuffer()));
  });server.listen(4180,'127.0.0.1');console.log('LOCAL FIXTURE http://127.0.0.1:4180/__fixture/login');await new Promise(()=>{});
 }
}finally{await mf.dispose();}

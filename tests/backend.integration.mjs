// Route Handler integration against an isolated Supabase HTTP fixture.
// This exercises the running Next app; it does not claim live Supabase/RLS proof.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const owner='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const state={tables:{invitations:[],guestbook:[],rsvps:[],invitation_photos:[]},writes:new Map(),counters:new Map(),objects:new Map(),failQuota:false,signs:0};
const fixture=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://fixture');const parts=[];for await(const b of req)parts.push(b);
    const raw=Buffer.concat(parts);const body=raw.length && req.headers['content-type']?.includes('json')?JSON.parse(raw):null;
    const send=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
    if(url.pathname==='/auth/v1/user') {
      const token=req.headers.authorization?.replace('Bearer ','');return token==='owner-token'?send({id:owner}):token==='other-token'?send({id:other}):send({error:'invalid'},401);
    }
    if(url.pathname==='/auth/v1/token')return send({access_token:'owner-token',refresh_token:'refresh-fixture',expires_in:3600});
    if(url.pathname==='/auth/v1/logout')return send({});
    if(url.pathname.endsWith('/rpc/consume_limits')) {
      if(state.failQuota)return send({error:'unavailable'},503);
      const reservations=body.limits.map(r=>({...r,key:`${r.actor}:${r.seconds}:${Math.floor(Date.now()/1000/r.seconds)}`}));
      if(reservations.some(r=>(state.counters.get(r.key)??0)+r.amount>r.max))return send({code:'P0001',message:'quota_exceeded'},400);
      for(const r of reservations)state.counters.set(r.key,(state.counters.get(r.key)??0)+r.amount);return send(null);
    }
    if(url.pathname.endsWith('/rpc/begin_write')) {
      const old=state.writes.get(body.write_key);
      if(old && old.hash!==body.payload_hash)return send({code:'P0001',message:'idempotency_conflict'},400);
      if(old?.response)return send({replay:true,response:old.response});
      if(old)return send({code:'P0001',message:'write_in_progress'},400);
      state.writes.set(body.write_key,{hash:body.payload_hash});return send({replay:false});
    }
    if(url.pathname.endsWith('/rpc/finish_write')) {state.writes.get(body.write_key).response=body.result;return send(null);}
    if(url.pathname.startsWith('/storage/v1/object/sign/')) {state.signs++;return send({signedURL:'/object/sign/invitation-photos/fixture.webp?token=fixture'});}
    if(url.pathname.startsWith('/storage/v1/object/')) {
      if(req.method==='POST')state.objects.set(url.pathname,raw);
      if(req.method==='DELETE')for(const p of body.prefixes)state.objects.delete(`/storage/v1/object/invitation-photos/${p}`);
      return send({});
    }
    const table=url.pathname.split('/').pop(),rows=state.tables[table];if(!rows)return send({error:'unknown table'},404);
    const matches=r=>[...url.searchParams].every(([k,v])=>{
      if(['select','order','limit','offset'].includes(k))return true;
      if(k==='or') {const photo=v.match(/\/api\/photos\/[a-f0-9-]{36}/)?.[0];return r.data.coverPhoto===photo || r.data.gallery.includes(photo);}
      if(v.startsWith('eq.'))return String(r[k])===v.slice(3);
      if(v==='is.null')return r[k]==null;
      if(v.startsWith('gt.'))return String(r[k])>v.slice(3);
      if(v.startsWith('in.('))return v.slice(4,-1).split(',').includes(r[k]);
      return false;
    });
    if(req.method==='POST') {
      if(table==='invitations' && rows.some(r=>r.slug===body.slug))return send({code:'23505'},409);
      const record={...body,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()};rows.push(record);return send([record]);
    }
    const selected=rows.filter(matches);
    if(req.method==='PATCH')for(const row of selected)Object.assign(row,body);
    if(req.method==='DELETE')state.tables[table]=rows.filter(r=>!matches(r));
    const start=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??1000);
    const columns=url.searchParams.get('select');
    return send(selected.slice(start,start+limit).map(r=>columns?Object.fromEntries(columns.split(',').map(k=>[k,r[k]])):r));
  } catch {res.writeHead(500);res.end('{}');}
});
await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:3412';
const log=createWriteStream('docs/evidence/backend-next.log');
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3412'],{env:{...process.env,NEXT_PUBLIC_DATA_MODE:'remote',SUPABASE_URL:`http://127.0.0.1:${fixture.address().port}`,SUPABASE_PUBLISHABLE_KEY:'fixture-publishable',SUPABASE_SERVICE_ROLE_KEY:'fixture-secret',ABUSE_HASH_SECRET:'fixture-hash-secret-at-least-32-characters',BACKEND_ENABLED:'true',ALLOW_LOCAL_SUPABASE:'true',NEXT_PUBLIC_SITE_URL:base}});
app.stdout.pipe(log);app.stderr.pipe(log);
let passed=0;
async function call(path,{method='GET',data,cookie,key=randomUUID(),origin=base,type='application/json',bytes}={}) {
  const response=await fetch(base+path,{method,redirect:'manual',headers:{Origin:origin,'Content-Type':type,'Idempotency-Key':key,...(cookie?{Cookie:`bom-access=${cookie}`}:{})},body:bytes??(data===undefined?undefined:JSON.stringify(data))});
  const body=(response.headers.get('content-type')??'').includes('json')?await response.json():await response.text();return {status:response.status,body,headers:response.headers};
}
async function check(name,fn){await fn();passed++;console.log(`PASS ${name}`);}
const partner={name:'샘플',order:'장남',englishName:'Sample'};
const inv={slug:'test-wedding',templateId:'blossom',type:'wedding',dateTime:'2027-03-28T12:30',wedding:{groom:partner,bride:{...partner,order:'장녀'}},venue:{name:'예시 장소',address:'예시 주소',lat:37.5,lng:127},greetingTitle:'초대합니다',greeting:'테스트 초대장',coverPhoto:'/photos/wedding-blossom.webp',gallery:['/photos/gallery-hands.webp'],accounts:[],options:{showCalendar:true,showDday:true,showGallery:true,showAccounts:false,showGuestbook:true,showRsvp:true,showEffect:false},shareTitle:'테스트 청첩장',shareDescription:'테스트 설명'};
try {
  let ready=false;for(let i=0;i<80;i++){try {if((await fetch(base+'/api/auth/session')).status===200){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,500));}assert(ready,'Next test server ready');
  state.counters.clear();
  await check('anonymous save denied',async()=>assert.equal((await call('/api/invitations/test-wedding',{method:'PUT',data:inv})).status,401));
  await check('cross-origin rejected before write',async()=>assert.equal((await call('/api/invitations/test-wedding',{method:'PUT',data:inv,cookie:'owner-token',origin:'https://attacker.example'})).status,403));
  await check('invalid photo URL rejected',async()=>assert.equal((await call('/api/invitations/test-wedding',{method:'PUT',data:{...inv,coverPhoto:'javascript:alert(1)'},cookie:'owner-token'})).status,400));
  await check('unknown sample photo rejected',async()=>assert.equal((await call('/api/invitations/test-wedding',{method:'PUT',data:{...inv,coverPhoto:'/photos/nonexistent.webp'},cookie:'owner-token'})).status,400));
  await check('OAuth callback without verified flow stays logged out',async()=>{const r=await call('/api/auth/callback?code=fixture-code&flow=forged');assert.equal(r.status,303);assert.equal(r.headers.get('location'),base+'/login?error=oauth');assert(!r.headers.get('set-cookie')?.includes('owner-token'));});
  const saveKey=randomUUID();
  await check('owner saves private draft',async()=>{const r=await call('/api/invitations/test-wedding',{method:'PUT',data:inv,cookie:'owner-token',key:saveKey});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.published,false);});
  await check('save replay creates one invitation',async()=>{assert.equal((await call('/api/invitations/test-wedding',{method:'PUT',data:inv,cookie:'owner-token',key:saveKey})).status,200);assert.equal(state.tables.invitations.length,1);});
  await check('same key with changed payload rejected',async()=>assert.equal((await call('/api/invitations/test-wedding',{method:'PUT',data:{...inv,greeting:'변경'},cookie:'owner-token',key:saveKey})).status,409));
  await check('draft invisible to other account',async()=>assert.equal((await call('/api/invitations/test-wedding',{cookie:'other-token'})).status,404));
  await check('other owner cannot overwrite slug',async()=>assert.equal((await call('/api/invitations/test-wedding',{method:'PUT',data:inv,cookie:'other-token'})).status,409));
  await check('other owner cannot publish',async()=>assert.equal((await call('/api/invitations/test-wedding/publish',{method:'POST',data:{published:true},cookie:'other-token'})).status,404));
  await check('draft guestbook writes denied',async()=>assert.equal((await call('/api/invitations/test-wedding/guestbook',{method:'POST',data:{name:'하객',message:'축하해요',password:'1234'}})).status,404));
  await check('owner publishes, anonymous can read',async()=>{assert.equal((await call('/api/invitations/test-wedding/publish',{method:'POST',data:{published:true},cookie:'owner-token'})).status,200);assert.equal((await call('/api/invitations/test-wedding')).status,200);});
  await check('server emits share metadata',async()=>{const r=await call('/i/test-wedding');assert.equal(r.status,200);assert.match(r.body,/property="og:image"/);assert.match(r.body,/wedding-blossom.webp/);});
  const guestKey=randomUUID(),entry={name:'하객',message:'축하합니다 <script>literal</script>',password:'good-password'};let guest;
  await check('guestbook hash stays server-side',async()=>{guest=await call('/api/invitations/test-wedding/guestbook',{method:'POST',data:entry,key:guestKey});assert.equal(guest.status,200);assert(!JSON.stringify(guest.body).includes('password'));assert.match(state.tables.guestbook[0].password_hash,/^scrypt:/);});
  await check('guestbook replay creates one entry',async()=>{assert.equal((await call('/api/invitations/test-wedding/guestbook',{method:'POST',data:entry,key:guestKey})).status,200);assert.equal(state.tables.guestbook.length,1);});
  await check('wrong deletion password rejected',async()=>assert.equal((await call(`/api/invitations/test-wedding/guestbook/${guest.body.id}`,{method:'DELETE',data:{password:'wrong-password'}})).status,403));
  await check('correct password deletes message',async()=>{assert.equal((await call(`/api/invitations/test-wedding/guestbook/${guest.body.id}`,{method:'DELETE',data:{password:entry.password}})).status,200);assert.equal((await call('/api/invitations/test-wedding/guestbook')).body.length,0);});
  const rsvp={side:'groom',name:'하객',attending:true,count:2,meal:'yes',memo:'테스트'};
  await check('RSVP validation rejects out-of-range count',async()=>assert.equal((await call('/api/invitations/test-wedding/rsvp',{method:'POST',data:{...rsvp,count:21}})).status,400));
  await check('RSVP accepted; list only available to owner',async()=>{assert.equal((await call('/api/invitations/test-wedding/rsvp',{method:'POST',data:rsvp})).status,200);assert.equal((await call('/api/invitations/test-wedding/rsvp',{cookie:'other-token'})).status,404);assert.equal((await call('/api/invitations/test-wedding/rsvp',{cookie:'owner-token'})).body.length,1);});
  await check('forged upload content rejected',async()=>assert.equal((await call('/api/uploads',{method:'POST',cookie:'owner-token',bytes:Buffer.from('<svg>bad</svg>'),type:'image/png'})).status,400));
  await check('oversized upload rejected',async()=>assert.equal((await call('/api/uploads',{method:'POST',cookie:'owner-token',bytes:Buffer.alloc(2*1024*1024+1),type:'image/png'})).status,413));
  let photo;
  await check('image upload converts into private storage',async()=>{photo=await call('/api/uploads',{method:'POST',cookie:'owner-token',bytes:await readFile('public/photos/wedding-classic.webp'),type:'image/webp'});assert.equal(photo.status,200,JSON.stringify(photo.body));assert.equal(state.objects.size,1);assert.match(photo.body.url,/^\/api\/photos\//);});
  await check('private photo denies guests, permits owner',async()=>{assert.equal((await call(photo.body.url)).status,404);assert.equal((await call(photo.body.url,{cookie:'owner-token'})).status,302);});
  await check('photo ownership prevents cross-account attachment',async()=>assert.equal((await call('/api/invitations/other-wedding',{method:'PUT',cookie:'other-token',data:{...inv,slug:'other-wedding',coverPhoto:photo.body.url}})).status,403));
  await check('attached published photo visible, stops on unpublish',async()=>{
    assert.equal((await call('/api/invitations/test-wedding',{method:'PUT',cookie:'owner-token',data:{...inv,coverPhoto:photo.body.url}})).status,200);
    assert.equal((await call(photo.body.url)).status,302);
    assert.equal((await call('/api/invitations/test-wedding/publish',{method:'POST',cookie:'owner-token',data:{published:false}})).status,200);
    assert.equal((await call(photo.body.url)).status,404);
  });
  await check('quota outage fails closed',async()=>{state.failQuota=true;const before=state.tables.invitations.length;assert.equal((await call('/api/invitations/new-wedding',{method:'PUT',cookie:'owner-token',data:{...inv,slug:'new-wedding'}})).status,503);assert.equal(state.tables.invitations.length,before);state.failQuota=false;});
  await check('rate limit rejects repeated writes',async()=>{state.counters.clear();let r;for(let i=0;i<21;i++)r=await call('/api/invitations/test-wedding/rsvp',{method:'POST',data:rsvp});assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'60');});
  console.log(`${passed} integration scenarios passed (Supabase HTTP fixture, not live DB).`);
} finally {app.kill('SIGTERM');await new Promise(resolve=>app.once('exit',resolve));fixture.closeAllConnections();await new Promise(resolve=>fixture.close(resolve));log.end();}

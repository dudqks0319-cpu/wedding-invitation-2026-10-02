import {TEMPLATES} from '../src/data/templates';
import {ALL_PHOTO_KEYS,photo as samplePhoto} from '../src/data/photos';
import {ApiError,invitationValue,guestbookValue,rsvpValue,object,slugValue,text,safeNext} from '../src/lib/server/validation';
import type {Invitation} from '../src/types/invitation';
import type {Env} from './types';
import {actor,csrf,hex,hmac,json,operation,publicQuota,quota,apiQuota,replay,response} from './security';
import {cleanup as cleanupPhotos,ownedPhotos,photo,removePhoto,upload} from './photos';
import {accountRoute,cleanupAccounts} from './accounts';
import {appleRoute} from './appleLogin';
import {guestIdentity,guestResponse,reportRoute} from './moderation';
import {operatorRoute} from './operator';
import {billingRoute} from './billing';
import {WEDDING_ORIGIN,startWeddingLogin,startNativeWeddingLogin,redeemNativeWeddingLogin} from './authBridge';
type Row={slug:string;owner_id:string;revision:number;data:string;public_data:string|null;expires_at:string;public_expires_at:string|null;moderation_hold?:number};
const output=(row:Row):Invitation=>({...JSON.parse(row.data),revision:row.revision,ownerView:true,published:!row.moderation_hold&&!!row.public_data&&(row.public_expires_at??'')>new Date().toISOString()});
function expires(inv:Invitation){
 const expiry=Date.parse(inv.dateTime+'+09:00')+30*86400000;
 if(expiry<Date.now()||Date.parse(inv.dateTime+'+09:00')>Date.now()+2*365*86400000)throw new ApiError(400,'행사일은 지난 30일 이내부터 앞으로 2년 이내로 선택해 주세요');
 return new Date(expiry).toISOString();
}
function revision(input:Record<string,unknown>){
 const n=input.revision??0;if(!Number.isSafeInteger(n)||(n as number)<0)throw new ApiError(400,'저장 버전을 확인해 주세요');return n as number;
}
async function find(env:Env,slug:string){return env.DB.prepare(`SELECT *,EXISTS(SELECT 1 FROM w2_moderation_holds WHERE slug=w2_invitations.slug) AS moderation_hold FROM w2_invitations WHERE slug=?
 AND NOT EXISTS(SELECT 1 FROM deletion_jobs WHERE owner_id=w2_invitations.owner_id AND state<>'complete')`).bind(slug).first<Row>();}
async function owned(env:Env,slug:string,owner:string){const row=await find(env,slug);if(!row||row.owner_id!==owner)throw new ApiError(404,'청첩장을 찾을 수 없어요');return row;}
async function published(env:Env,slug:string){const row=await find(env,slug);if(!row?.public_data||row.moderation_hold||(row.public_expires_at??'')<=new Date().toISOString())throw new ApiError(404,'청첩장을 찾을 수 없어요');return row;}
export async function route(env:Env,request:Request):Promise<Response>{
 const url=new URL(request.url),path=url.pathname.replace(/^\/api\/v2\/?/,'').split('/').filter(Boolean),[first,slugRaw,action,id]=path;
 const enabled=await env.DB.prepare("SELECT enabled FROM w2_controls WHERE name='api'").first<{enabled:number}>();
 if(enabled?.enabled!==1)throw new ApiError(503,'서비스를 점검 중이에요. 잠시 후 다시 시도해 주세요');
 if(first==='health')return response({status:'ok',backend:'cloudflare',storage:'D1/R2',schema:2});
 if(first==='account')return accountRoute(env,request,slugRaw??'');
 if(first==='billing'&&path.length===2)return billingRoute(env,request,slugRaw);
 if(first==='reports')return reportRoute(env,request);
 if(first==='operator')return operatorRoute(env,request,slugRaw??'');
 if(first==='auth'){
  if(slugRaw==='apple')return appleRoute(env,request,action??'');
  if(env.NEXT_PUBLIC_SITE_URL===WEDDING_ORIGIN&&url.pathname==='/api/v2/auth/native/start'&&request.method==='GET')return startNativeWeddingLogin(env,request);
  if(env.NEXT_PUBLIC_SITE_URL===WEDDING_ORIGIN&&url.pathname==='/api/v2/auth/native/redeem'&&request.method==='POST')return redeemNativeWeddingLogin(env,request);
  if(request.method==='POST'&&slugRaw==='start'){
   if(env.NEXT_PUBLIC_SITE_URL===WEDDING_ORIGIN)return startWeddingLogin(env,request);
   csrf(env,request);const input=object(await json(request)),provider=text(input.provider,10,'로그인');
   if(!['kakao','google'].includes(provider))throw new ApiError(400,'카카오 또는 Google로 로그인해 주세요');
   const next=safeNext(input.next),result=new URL(`/auth/${provider}`,env.NEXT_PUBLIC_SITE_URL??url.origin);
   // Existing provider registrations and identity subjects are retained.
   const res=response({url:result.href});res.headers.set('Set-Cookie',`__Host-w2-return=${encodeURIComponent(next)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);return res;
  }
  // Logout must clear the HttpOnly cookie even when its session already expired or was revoked.
  if(request.method==='POST'&&slugRaw==='logout'){
   csrf(env,request);await json(request);
   const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-osam-session=([a-f0-9]{48})(?:;|$)/)?.[1];
   if(token){const digest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(digest).run();}
   const res=response({signedOut:true});res.headers.set('Set-Cookie','__Host-osam-session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');return res;
  }
  const user=(await actor(env,request))!;
  if(request.method==='GET'&&slugRaw==='session')return response(user);
  throw new ApiError(404,'요청을 찾을 수 없어요');
 }
 if(first==='uploads'&&request.method==='POST')return upload(env,request);
 if(first==='photos'&&['GET','HEAD'].includes(request.method)){await publicQuota(env,request);return photo(env,request,slugRaw??'');}
 if(first==='photos'&&request.method==='DELETE'){
  const user=(await actor(env,request))!;csrf(env,request);await json(request);
  const p=await env.DB.prepare('SELECT * FROM w2_photos WHERE id=? AND owner_id=?').bind(slugRaw,user.id).first<Parameters<typeof removePhoto>[1]>();if(!p)throw new ApiError(404,'사진을 찾을 수 없어요');
  const referenced=await env.DB.prepare(`SELECT slug FROM w2_invitations WHERE owner_id=? AND
  (instr(data,?)>0 OR instr(COALESCE(public_data,''),?)>0)`).bind(user.id,`/api/photos/${p.id}`,`/api/photos/${p.id}`).first();if(referenced)throw new ApiError(409,'청첩장에서 사진을 먼저 제거해 주세요');
  if(!await removePhoto(env,p))throw new ApiError(409,'사진이 사용 중이에요. 청첩장에서 먼저 제거해 주세요');return response({deleted:true});
 }
 if(first!=='invitations')throw new ApiError(404,'요청을 찾을 수 없어요');
 if(!slugRaw){
  const user=(await actor(env,request))!;if(request.method!=='GET')throw new ApiError(405,'지원하지 않는 요청이에요');
  const list=(await env.DB.prepare('SELECT *,EXISTS(SELECT 1 FROM w2_moderation_holds WHERE slug=w2_invitations.slug) AS moderation_hold FROM w2_invitations WHERE owner_id=? ORDER BY updated_at DESC LIMIT 20').bind(user.id).all<Row>()).results;
  return response(Object.fromEntries(list.map(r=>[r.slug,output(r)])));
 }
 const slug=slugValue(slugRaw);
 if(request.method==='GET'||request.method==='HEAD'){
  await publicQuota(env,request);const user=await actor(env,request,false);
  if(!action){const row=await find(env,slug);if(!row)throw new ApiError(404,'청첩장을 찾을 수 없어요');
   if(user?.id===row.owner_id)return response(output(row));
   if(!row.public_data||row.moderation_hold||(row.public_expires_at??'')<=new Date().toISOString())throw new ApiError(404,'청첩장을 찾을 수 없어요');return response({...JSON.parse(row.public_data),published:true});}
  if(action==='rsvp'){
   await owned(env,slug,user?.id??'');const list=(await env.DB.prepare('SELECT id,data,created_at FROM w2_rsvp WHERE slug=? ORDER BY created_at DESC LIMIT 500').bind(slug).all<{id:string;data:string;created_at:string}>()).results;
   return response(list.map(r=>({...JSON.parse(r.data),id:r.id,createdAt:r.created_at})));
  }
  if(action==='moderation'){
   await owned(env,slug,user?.id??'');return response((await env.DB.prepare('SELECT id,name,message,approved,created_at AS createdAt FROM w2_guestbook WHERE slug=? ORDER BY created_at DESC LIMIT 100').bind(slug).all()).results);
  }
  if(action==='guestbook'){
   const p=await published(env,slug);if(!JSON.parse(p.public_data!).options.showGuestbook)throw new ApiError(404,'방명록을 사용하지 않아요');
   return guestResponse(env,request,(await env.DB.prepare('SELECT id,name,message,created_at AS createdAt FROM w2_guestbook WHERE slug=? AND approved=1 ORDER BY created_at DESC LIMIT 100').bind(slug).all()).results);
  }
  throw new ApiError(404,'요청을 찾을 수 없어요');
 }
 if(!['PUT','POST','DELETE','PATCH'].includes(request.method))throw new ApiError(405,'지원하지 않는 요청이에요');
 csrf(env,request);const raw=await json(request),input=object(raw);
 const guest=action==='rsvp'||action==='guestbook';
 const user=await actor(env,request,!guest);
 let scope:string;
 if(guest){const key=await publicQuota(env,request,true);scope=`guest:${key}:${slug}:${action}:${request.method}:${id??''}`;}
 else{await quota(env,user!.id,'owner-write',120,60);scope=`${user!.id}:${slug}:${action??'draft'}:${request.method}:${id??''}`;}
 const repeated=await replay(env,request,scope,raw);if(repeated)return response(repeated);
 const now=new Date().toISOString();
 if(!action&&request.method==='PUT'){
  const inv=invitationValue(raw,TEMPLATES);if(inv.slug!==slug)throw new ApiError(400,'청첩장 주소는 저장 후 바꿀 수 없어요');
  const samples=new Set(ALL_PHOTO_KEYS.map(samplePhoto));if([inv.coverPhoto,...inv.gallery].some(p=>p.startsWith('/photos/')&&!samples.has(p)))throw new ApiError(400,'예시 사진을 다시 골라 주세요');
  await ownedPhotos(env,user!.id,[inv.coverPhoto,...inv.gallery]);const current=await find(env,slug),expected=revision(input);
  if(current&&(current.owner_id!==user!.id||current.revision!==expected)||!current&&expected!==0)throw new ApiError(409,'다른 곳에서 변경됐거나 사용 중인 주소예요. 다시 불러와 주세요');
  if(!current&&(await env.DB.prepare('SELECT COUNT(*) AS n FROM w2_invitations WHERE owner_id=?').bind(user!.id).first<{n:number}>())!.n>=20)throw new ApiError(429,'청첩장은 20개까지 저장할 수 있어요');
  const expiry=expires(inv),next={...inv,revision:expected+1,published:current?output(current).published:false};
  const ids=[...new Set([inv.coverPhoto,...inv.gallery].filter(p=>p.startsWith('/api/photos/')).map(p=>p.split('/').pop()))];
  const photoGuard="(SELECT COUNT(*) FROM w2_photos WHERE owner_id=? AND state='ready' AND id IN(SELECT value FROM json_each(?)))=?";
  const result=await operation(env,request,scope,raw,next,(guard,claim,mutation)=>[
   current?env.DB.prepare(`UPDATE w2_invitations SET data=?,revision=revision+1,updated_at=?,expires_at=? WHERE slug=? AND owner_id=? AND revision=? AND ${guard} AND ${photoGuard}`).bind(JSON.stringify(inv),now,expiry,slug,user!.id,expected,scope,mutation,claim,user!.id,JSON.stringify(ids),ids.length)
   :env.DB.prepare(`INSERT INTO w2_invitations SELECT ?,?,1,?,NULL,?,NULL,? WHERE ${guard} AND ${photoGuard} AND (SELECT COUNT(*) FROM w2_invitations WHERE owner_id=?)<20 ON CONFLICT(slug) DO NOTHING`).bind(slug,user!.id,JSON.stringify(inv),expiry,now,scope,mutation,claim,user!.id,JSON.stringify(ids),ids.length,user!.id)
  ]);return response(result,current?200:201);
 }
 if(!action&&request.method==='DELETE'){
  const current=await owned(env,slug,user!.id),data=JSON.parse(current.data),pub=current.public_data?JSON.parse(current.public_data):null;
  const ids=[...new Set([data.coverPhoto,...data.gallery,...(pub?[pub.coverPhoto,...pub.gallery]:[])].filter((p:string)=>p.startsWith('/api/photos/')).map((p:string)=>p.split('/').pop()))];
  const result=await operation(env,request,scope,raw,{deleted:true},(guard,claim,mutation)=>[
   // Owner scopes start with `${owner}:${slug}:`; guest scopes carry the slug after `guest:` and a 64-hex key.
   env.DB.prepare(`DELETE FROM w2_operations WHERE (substr(scope,1,length(?))=? OR (substr(scope,1,6)='guest:' AND substr(scope,72,length(?))=?)) AND NOT(scope=? AND id=?) AND ${guard}`).bind(`${user!.id}:${slug}:`,`${user!.id}:${slug}:`,`${slug}:`,`${slug}:`,scope,mutation,scope,mutation,claim),
   env.DB.prepare(`UPDATE w2_photos SET state='deleting' WHERE owner_id=? AND id IN(SELECT value FROM json_each(?)) AND ${guard}
    AND NOT EXISTS(SELECT 1 FROM w2_invitations i WHERE i.slug<>? AND i.owner_id=w2_photos.owner_id AND
     (instr(i.data,'/api/photos/'||w2_photos.id)>0 OR instr(COALESCE(i.public_data,''),'/api/photos/'||w2_photos.id)>0))`).bind(user!.id,JSON.stringify(ids),scope,mutation,claim,slug),
   env.DB.prepare(`DELETE FROM w2_invitations WHERE slug=? AND owner_id=? AND ${guard}`).bind(slug,user!.id,scope,mutation,claim)
  ]);return response(result);
 }
 if(action==='publish'&&request.method==='POST'){
  const current=await owned(env,slug,user!.id);if(typeof input.published!=='boolean')throw new ApiError(400,'공유 상태를 확인해 주세요');
  if(input.published&&current.moderation_hold)throw new ApiError(403,'신고 검토로 공개가 제한됐어요. 고객지원으로 문의해 주세요');
  const inv=invitationValue(JSON.parse(current.data),TEMPLATES);
  if(input.published&&[inv.coverPhoto,...inv.gallery].some(p=>!p.startsWith('/api/photos/')))throw new ApiError(400,'AI 예시 사진을 실제 사진으로 바꾸고, 갤러리의 예시 사진도 지워 주세요');
  await ownedPhotos(env,user!.id,[inv.coverPhoto,...inv.gallery]);
  const publicContent={...inv,accounts:inv.options.showAccounts?inv.accounts:[],gallery:inv.options.showGallery?inv.gallery:[]};
  const expected=revision(input);if(expected!==current.revision)throw new ApiError(409,'최신 청첩장을 다시 불러와 주세요');
  return response(await operation(env,request,scope,raw,{...inv,revision:expected,published:input.published},(guard,claim,mutation)=>[
   env.DB.prepare(`UPDATE w2_invitations SET public_data=?,public_expires_at=?,updated_at=? WHERE slug=? AND owner_id=? AND revision=? AND ${guard} ${input.published?'AND NOT EXISTS(SELECT 1 FROM w2_moderation_holds WHERE slug=w2_invitations.slug)':''}`).bind(input.published?JSON.stringify(publicContent):null,input.published?expires(inv):null,now,slug,user!.id,expected,scope,mutation,claim)]));
 }
 if(action==='moderation'&&request.method==='DELETE'){
  await owned(env,slug,user!.id);const entry=text(input.id,36,'글');
  return response(await operation(env,request,scope,raw,{deleted:true},(guard,claim,mutation)=>[env.DB.prepare(`DELETE FROM w2_guestbook WHERE id=? AND slug=? AND ${guard}`).bind(entry,slug,scope,mutation,claim)]));
 }
 if(action==='moderation'&&request.method==='POST'){
  await owned(env,slug,user!.id);const entry=text(input.id,36,'글');
  const author=await env.DB.prepare('SELECT author_key FROM w2_guest_authors WHERE entry_id=? AND EXISTS(SELECT 1 FROM w2_guestbook WHERE id=? AND slug=?)').bind(entry,entry,slug).first<{author_key:string}>();
  if(!author)throw new ApiError(409,'이전에 등록된 메시지는 작성자 차단 대신 삭제해 주세요');
  return response(await operation(env,request,scope,raw,{blocked:true},(guard,claim,mutation)=>[
   env.DB.prepare(`INSERT INTO w2_guest_blocks SELECT ?,?,? WHERE ${guard} ON CONFLICT(slug,author_key) DO NOTHING`).bind(slug,author.author_key,now,scope,mutation,claim),
   env.DB.prepare(`UPDATE w2_guestbook SET approved=0 WHERE slug=? AND id IN(SELECT entry_id FROM w2_guest_authors WHERE author_key=?) AND ${guard}`).bind(slug,author.author_key,scope,mutation,claim),
  ]));
 }
 if(action==='moderation'&&request.method==='PATCH'){
  await owned(env,slug,user!.id);const entry=text(input.id,36,'글'),approved=input.approved;if(typeof approved!=='boolean')throw new ApiError(400,'승인 상태를 확인해 주세요');
  if(approved&&await env.DB.prepare('SELECT b.author_key FROM w2_guest_blocks b JOIN w2_guest_authors a ON a.author_key=b.author_key WHERE b.slug=? AND a.entry_id=?').bind(slug,entry).first())throw new ApiError(403,'차단한 작성자의 메시지는 공개할 수 없어요');
  return response(await operation(env,request,scope,raw,{updated:true},(guard,claim,mutation)=>[env.DB.prepare(`UPDATE w2_guestbook SET approved=? WHERE id=? AND slug=? AND ${guard} ${approved?'AND NOT EXISTS(SELECT 1 FROM w2_guest_blocks b JOIN w2_guest_authors a ON a.author_key=b.author_key WHERE b.slug=w2_guestbook.slug AND a.entry_id=w2_guestbook.id)':''}`).bind(approved?1:0,entry,slug,scope,mutation,claim)]));
 }
 if(action==='guestbook'&&request.method==='DELETE'&&id){
  const entry=await env.DB.prepare('SELECT password_hash,salt FROM w2_guestbook WHERE id=? AND slug=?').bind(id,slug).first<{password_hash:string;salt:string}>();if(!entry)throw new ApiError(404,'글을 찾을 수 없어요');
  const hash=await hmac(env,`guest-password:${entry.salt}:${text(input.password,64,'비밀번호')}`);
  const a=new TextEncoder().encode(hash),b=new TextEncoder().encode(entry.password_hash);let diff=a.length^b.length;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];if(diff)throw new ApiError(403,'비밀번호를 확인해 주세요');
  return response(await operation(env,request,scope,raw,{deleted:true},(guard,claim,mutation)=>[env.DB.prepare(`DELETE FROM w2_guestbook WHERE id=? AND slug=? AND ${guard}`).bind(id,slug,scope,mutation,claim)]));
 }
 const pub=await published(env,slug),inv=JSON.parse(pub.public_data!) as Invitation;
 if(action==='rsvp'&&request.method==='POST'){
  if(!inv.options.showRsvp)throw new ApiError(404,'참석 응답을 사용하지 않아요');
  const value=rsvpValue(raw),id=crypto.randomUUID(),result={...value,id,createdAt:now};
  return response(await operation(env,request,scope,raw,result,(guard,claim,mutation)=>[env.DB.prepare(`INSERT INTO w2_rsvp SELECT ?,?,?,? WHERE ${guard} AND EXISTS(SELECT 1 FROM w2_invitations WHERE slug=? AND public_data IS NOT NULL AND public_expires_at>? AND NOT EXISTS(SELECT 1 FROM w2_moderation_holds WHERE slug=w2_invitations.slug)) AND (SELECT COUNT(*) FROM w2_rsvp WHERE slug=?)<500`).bind(id,slug,JSON.stringify(value),now,scope,mutation,claim,slug,now,slug)]),201);
 }
 if(action==='guestbook'&&request.method==='POST'&&!id){
  if(!inv.options.showGuestbook)throw new ApiError(404,'방명록을 사용하지 않아요');
  const identity=await guestIdentity(env,request);
  if(await env.DB.prepare('SELECT author_key FROM w2_guest_blocks WHERE slug=? AND author_key=?').bind(slug,identity.key).first())throw new ApiError(403,'이 청첩장에는 메시지를 작성할 수 없어요');
  const value=guestbookValue(raw),entry=crypto.randomUUID(),salt=crypto.randomUUID(),hash=await hmac(env,`guest-password:${salt}:${value.password}`);
  const result={id:entry,name:value.name,message:value.message,createdAt:now,pending:true};
  const saved=await operation(env,request,scope,raw,result,(guard,claim,mutation)=>[
   env.DB.prepare(`INSERT INTO w2_guestbook SELECT ?,?,?,?,?,?,?,0 WHERE ${guard} AND EXISTS(SELECT 1 FROM w2_invitations WHERE slug=? AND public_data IS NOT NULL AND public_expires_at>? AND NOT EXISTS(SELECT 1 FROM w2_moderation_holds WHERE slug=w2_invitations.slug)) AND NOT EXISTS(SELECT 1 FROM w2_guest_blocks WHERE slug=? AND author_key=?) AND (SELECT COUNT(*) FROM w2_guestbook WHERE slug=?)<100`).bind(entry,slug,value.name,value.message,hash,salt,now,scope,mutation,claim,slug,now,slug,identity.key,slug),
   env.DB.prepare(`INSERT INTO w2_guest_authors SELECT ?,? WHERE ${guard} AND EXISTS(SELECT 1 FROM w2_guestbook WHERE id=? AND slug=?)`).bind(entry,identity.key,scope,mutation,claim,entry,slug)
  ]);
  const res=response(saved,201);if(identity.cookie)res.headers.set('Set-Cookie',identity.cookie);return res;
 }

 throw new ApiError(404,'요청을 찾을 수 없어요');
}
export async function api(env:Env,request:Request){
 try{await apiQuota(env);return await route(env,request);}catch(error){
  if(error instanceof ApiError){const res=response({error:error.message},error.status);if(error.status===429)res.headers.set('Retry-After','60');return res;}
  // No body, names, IP, passwords or tokens in logs.
  console.error('w2_backend_failure',error instanceof Error?error.name:'unknown');return response({error:'서비스 연결을 확인하고 있어요. 잠시 후 다시 시도해 주세요'},503);
 }
}
export async function cleanup(env:Env){await cleanupPhotos(env);await cleanupAccounts(env);}

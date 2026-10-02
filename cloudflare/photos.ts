import {ApiError} from '../src/lib/server/validation';
import {actor,bytes,csrf,hmac,quota,response} from './security';
import type {Env} from './types';
type Photo={id:string;owner_id:string;key:string;bytes:number;state:string;fingerprint:string};
const stream=(b:Uint8Array)=>new ReadableStream({start(c){c.enqueue(b);c.close();}});
async function imageDeadline<T>(promise:Promise<T>):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new ApiError(504,'사진 처리가 지연되고 있어요. 잠시 후 다시 시도해 주세요')),8000);})]);}
 finally{clearTimeout(timer);}
}
async function enabled(env:Env){
 const row=await env.DB.prepare("SELECT enabled FROM w2_controls WHERE name='uploads'").first<{enabled:number}>();
 if(row?.enabled!==1)throw new ApiError(503,'사진 저장을 점검 중이에요. 잠시 후 다시 시도해 주세요');
}
export async function removePhoto(env:Env,photo:Photo){
 const claimed=await env.DB.prepare(`UPDATE w2_photos SET state='deleting' WHERE id=? AND
 (state='deleting' OR NOT EXISTS(SELECT 1 FROM w2_invitations i WHERE i.owner_id=w2_photos.owner_id AND
 (instr(i.data,'/api/photos/'||w2_photos.id)>0 OR instr(COALESCE(i.public_data,''),'/api/photos/'||w2_photos.id)>0))) RETURNING id`).bind(photo.id).first();
 if(!claimed)return false;
 // Keep the reservation until R2 confirms removal, including provider failures.
 await quota(env,'global','r2-write',2000,86400);
 await env.MEDIA.delete(photo.key);
 await env.DB.prepare("DELETE FROM w2_photos WHERE id=? AND state='deleting'").bind(photo.id).run();
 return true;
}
export async function upload(env:Env,request:Request){
 const user=(await actor(env,request))!,mutation=csrf(env,request);await enabled(env);
 await quota(env,user.id,'upload',60,3600);
 if(!['image/jpeg','image/png','image/webp'].includes(request.headers.get('content-type')??''))throw new ApiError(415,'JPG·PNG·WebP 사진을 선택해 주세요');
 const data=await bytes(request,2*1024*1024),fingerprint=await hmac(env,Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).join(','));
 const previous=await env.DB.prepare('SELECT * FROM w2_photos WHERE owner_id=? AND mutation_id=?').bind(user.id,mutation).first<Photo>();
 if(previous){if(previous.fingerprint!==fingerprint)throw new ApiError(409,'요청 번호에 다른 사진이 있어요');if(previous.state==='ready')return response({url:`/api/photos/${previous.id}`});throw new ApiError(409,'사진 처리 중이에요. 잠시 후 다시 시도해 주세요');}
 if(!env.IMAGES)throw new ApiError(503,'사진 저장 연결을 확인하고 있어요');
 const id=crypto.randomUUID(),key=`w2/${user.id}/${id}.webp`,maxBytes=1572864;
 const claimed=await env.DB.prepare(`INSERT INTO w2_photos
 SELECT ?,?,?,?,'uploading',?,?,? WHERE
 (SELECT COALESCE(SUM(bytes),0) FROM w2_photos)+?<=1000000000 AND
 (SELECT COALESCE(SUM(bytes),0) FROM w2_photos WHERE owner_id=?)+?<=100000000 AND
 (SELECT COUNT(*) FROM w2_photos WHERE state='uploading')<4 RETURNING id`)
 .bind(id,user.id,key,maxBytes,mutation,fingerprint,new Date().toISOString(),maxBytes,user.id,maxBytes).first();
 if(!claimed)throw new ApiError(429,'사진 저장 공간 또는 처리 한도에 도달했어요. 사용하지 않는 사진을 지운 뒤 다시 시도해 주세요');
 try{
  let info;try{info=await imageDeadline(env.IMAGES.info(stream(data)));}catch(error){if(error instanceof ApiError)throw error;throw new ApiError(400,'사진 파일을 확인해 주세요');}
  if(!info.width||!info.height||info.width*info.height>40000000||!['image/jpeg','image/png','image/webp','jpeg','png','webp'].includes(info.format))throw new ApiError(400,'사진 파일을 확인해 주세요');
  await quota(env,'global','image-transform',100,86400);
  const transformed=(await imageDeadline(env.IMAGES.input(stream(data)).transform({width:1600,height:1600,fit:'scale-down',metadata:'none'}).output({format:'image/webp',quality:82,anim:false}))).response();
  if(!transformed.ok)throw new ApiError(503,'사진을 처리하지 못했어요');
  const output=await bytes(new Request('https://image.local',{method:'POST',body:transformed.body,duplex:'half'} as RequestInit),maxBytes);
  await quota(env,'global','r2-write',2000,86400);
  await env.MEDIA.put(key,output,{httpMetadata:{contentType:'image/webp'}});
  const ready=await env.DB.prepare("UPDATE w2_photos SET state='ready',bytes=? WHERE id=? AND state='uploading' RETURNING id").bind(output.length,id).first();
  if(!ready)throw new ApiError(503,'사진을 저장하지 못했어요');
  return response({url:`/api/photos/${id}`},201);
 }catch(error){
  await env.DB.prepare("UPDATE w2_photos SET state='deleting' WHERE id=?").bind(id).run();
  try{await removePhoto(env,{id,owner_id:user.id,key,bytes:maxBytes,state:'deleting',fingerprint});}catch{/* Scheduled cleanup retries; storage remains reserved. */}
  throw error;
 }
}
export async function photo(env:Env,request:Request,id:string){
 if(!/^[a-f0-9-]{36}$/.test(id))throw new ApiError(404,'사진을 찾을 수 없어요');
 const user=await actor(env,request,false),row=await env.DB.prepare("SELECT * FROM w2_photos WHERE id=? AND state='ready'").bind(id).first<Photo>();
 if(!row)throw new ApiError(404,'사진을 찾을 수 없어요');
 const reference=`EXISTS(SELECT 1 FROM w2_invitations i WHERE i.owner_id=w2_photos.owner_id AND i.public_data IS NOT NULL AND i.public_expires_at>?
 AND NOT EXISTS(SELECT 1 FROM deletion_jobs WHERE owner_id=i.owner_id AND state<>'complete')
 AND (json_extract(i.public_data,'$.coverPhoto')=? OR EXISTS(SELECT 1 FROM json_each(i.public_data,'$.gallery') WHERE value=?)))`;
 if(user?.id!==row.owner_id&&!await env.DB.prepare(`SELECT id FROM w2_photos WHERE id=? AND ${reference}`).bind(id,new Date().toISOString(),`/api/photos/${id}`,`/api/photos/${id}`).first())throw new ApiError(404,'사진을 찾을 수 없어요');
 await quota(env,'global','r2-read',20000,86400);
 const object=await env.MEDIA.get(row.key);if(!object)throw new ApiError(404,'사진을 찾을 수 없어요');
 // Stable OG URL, but no client/shared cache can outlive unpublish revocation.
 return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':'image/webp','Content-Length':String(object.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
export async function ownedPhotos(env:Env,owner:string,urls:string[]){
 const ids=[...new Set(urls.filter(s=>s.startsWith('/api/photos/')).map(s=>s.split('/').pop()))];if(!ids.length)return;
 const rows=(await env.DB.prepare(`SELECT id FROM w2_photos WHERE owner_id=? AND state='ready' AND id IN(SELECT value FROM json_each(?))`).bind(owner,JSON.stringify(ids)).all()).results;
 if(rows.length!==ids.length)throw new ApiError(403,'본인이 올린 사진만 사용할 수 있어요');
}
export async function cleanup(env:Env){
 const now=new Date().toISOString();
 // New tables only. Existing account and v1 retention jobs remain owned by v1.
 await env.DB.batch([
  env.DB.prepare(`DELETE FROM w2_operations WHERE EXISTS(SELECT 1 FROM deletion_jobs j WHERE j.state<>'complete' AND
   (w2_operations.scope LIKE j.owner_id||':%' OR EXISTS(SELECT 1 FROM w2_invitations i WHERE i.owner_id=j.owner_id AND instr(w2_operations.scope,':'||i.slug||':')>0)))`),
  env.DB.prepare("UPDATE w2_invitations SET public_data=NULL,public_expires_at=NULL WHERE slug IN(SELECT slug FROM w2_invitations WHERE public_expires_at<? LIMIT 100)").bind(now),
  env.DB.prepare(`DELETE FROM w2_invitations WHERE slug IN(SELECT slug FROM w2_invitations WHERE expires_at<? OR owner_id IN(SELECT owner_id FROM deletion_jobs WHERE state<>'complete') LIMIT 100)`).bind(now),
  env.DB.prepare('DELETE FROM w2_operations WHERE rowid IN(SELECT rowid FROM w2_operations WHERE expires_at<? LIMIT 500)').bind(Date.now()),
  env.DB.prepare('DELETE FROM w2_limits WHERE rowid IN(SELECT rowid FROM w2_limits WHERE expires_at<? LIMIT 500)').bind(Math.floor(Date.now()/1000)-86400),
 ]);
 const stale=new Date(Date.now()-86400000).toISOString();
 const rows=(await env.DB.prepare(`SELECT * FROM w2_photos p WHERE state='deleting' OR owner_id IN(SELECT owner_id FROM deletion_jobs WHERE state<>'complete') OR (created_at<? AND
 NOT EXISTS(SELECT 1 FROM w2_invitations i WHERE i.owner_id=p.owner_id AND
 (json_extract(i.data,'$.coverPhoto')='/api/photos/'||p.id OR EXISTS(SELECT 1 FROM json_each(i.data,'$.gallery') WHERE value='/api/photos/'||p.id)
 OR json_extract(i.public_data,'$.coverPhoto')='/api/photos/'||p.id OR EXISTS(SELECT 1 FROM json_each(i.public_data,'$.gallery') WHERE value='/api/photos/'||p.id)))) LIMIT 25`).bind(stale).all<Photo>()).results;
 for(const p of rows)await removePhoto(env,p);
}

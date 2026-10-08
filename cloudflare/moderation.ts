import type {Env} from './types';
import {ApiError,object,slugValue,text} from '../src/lib/server/validation';
import {csrf,hex,hmac,json,publicQuota,quota,response} from './security';

const cookieName='__Host-w2-guest';
export async function guestIdentity(env:Env,request:Request){
 const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-w2-guest=([a-f0-9]{64})(?:;|$)/)?.[1];
 const value=token??hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
 return {key:await hmac(env,'guest-author:'+value),cookie:token?null:`${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${180*86400}`};
}
export async function guestResponse(env:Env,request:Request,value:unknown,status=200){
 const identity=await guestIdentity(env,request),res=response(value,status);if(identity.cookie)res.headers.set('Set-Cookie',identity.cookie);return res;
}
export async function reportRoute(env:Env,request:Request){
 if(request.method!=='POST')throw new ApiError(405,'지원하지 않는 요청이에요');
 const mutation=csrf(env,request),ip=await publicQuota(env,request,true),input=object(await json(request));
 const slug=slugValue(input.slug),entry=text(input.entryId,36,'글',false),reason=text(input.reason,20,'신고 유형'),message=text(input.message,500,'신고 내용',false);
 if(!['abuse','privacy','copyright','other'].includes(reason)||entry&&!/^[a-f0-9-]{36}$/.test(entry))throw new ApiError(400,'신고 항목을 확인해 주세요');
 const control=await env.DB.prepare("SELECT enabled FROM w2_controls WHERE name='reports'").first<{enabled:number}>();
 if(control?.enabled!==1)throw new ApiError(503,'신고 접수를 점검 중이에요');
 await quota(env,ip,'report',5,86400);await quota(env,'global','report',200,86400);
 const inv=await env.DB.prepare('SELECT slug FROM w2_invitations WHERE slug=? AND public_data IS NOT NULL AND public_expires_at>? AND NOT EXISTS(SELECT 1 FROM w2_moderation_holds WHERE slug=w2_invitations.slug)').bind(slug,new Date().toISOString()).first();
 if(!inv)throw new ApiError(404,'공개 청첩장을 찾을 수 없어요');
 if(entry&&!await env.DB.prepare('SELECT id FROM w2_guestbook WHERE id=? AND slug=? AND approved=1').bind(entry,slug).first())throw new ApiError(404,'메시지를 찾을 수 없어요');
 await env.DB.prepare(`INSERT INTO w2_reports(id,slug,entry_id,reporter_key,reason,message,created_at,mutation_id)
  SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM w2_reports)<10000 ON CONFLICT(reporter_key,mutation_id) DO NOTHING`)
  .bind(crypto.randomUUID(),slug,entry||null,ip,reason,message,new Date().toISOString(),mutation).run();
 const row=await env.DB.prepare('SELECT id,slug,entry_id,reason,message FROM w2_reports WHERE reporter_key=? AND mutation_id=?').bind(ip,mutation).first<{id:string;slug:string;entry_id:string|null;reason:string;message:string}>();
 if(!row)throw new ApiError(429,'신고 접수 한도에 도달했어요. 고객지원으로 연락해 주세요');
 if(row.slug!==slug||row.entry_id!==(entry||null)||row.reason!==reason||row.message!==message)throw new ApiError(409,'요청 번호에 다른 신고 내용이 있어요');
 return response({id:row.id,status:'received'},201);
}

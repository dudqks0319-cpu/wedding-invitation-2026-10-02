import type {Env} from './types';
import {ApiError,object,text} from '../src/lib/server/validation';
import {actor,csrf,hex,json,operation,quota,replay,response} from './security';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
/** Server-side allowlist only. Ordinary accounts cannot grant themselves a role. */
export async function operatorRoute(env:Env,request:Request,action:string){
 const user=(await actor(env,request))!;
 const operators=(env.WEDDING_OPERATOR_IDS??'').split(',').map(s=>s.trim()).filter(Boolean);
 if(!operators.length||operators.length>3||operators.some(id=>!uuid.test(id))||!operators.includes(user.id))throw new ApiError(403,'운영자 계정만 사용할 수 있어요');
 await quota(env,user.id,'operator-access',60,3600);
 if(action==='queue'&&request.method==='GET'){
  const [support,reports]=await Promise.all([
   env.DB.prepare("SELECT id,category,message,status,reply,created_at AS createdAt FROM w2_support ORDER BY CASE WHEN status='received' THEN 0 ELSE 1 END,CASE WHEN status='received' THEN created_at END ASC,created_at DESC LIMIT 50").all(),
   env.DB.prepare("SELECT id,slug,entry_id AS entryId,reason,message,status,created_at AS createdAt FROM w2_reports ORDER BY CASE WHEN status='received' THEN 0 ELSE 1 END,CASE WHEN status='received' THEN created_at END ASC,created_at DESC LIMIT 50").all(),
  ]);
  return response({support:support.results,reports:reports.results});
 }
 if(request.method!=='POST'||!['support','reports'].includes(action))throw new ApiError(405,'지원하지 않는 요청이에요');
 csrf(env,request);const input=object(await json(request)),id=text(input.id,36,'접수번호');
 if(!uuid.test(id))throw new ApiError(400,'접수번호를 확인해 주세요');
 const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-osam-session=([a-f0-9]{48})(?:;|$)/)?.[1];
 const hash=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token!)));
 const session=await env.DB.prepare('SELECT created_at FROM sessions WHERE token_hash=?').bind(hash).first<{created_at:string}>();
 if(!session||Date.parse(session.created_at)<Date.now()-15*60000)throw new ApiError(403,'운영 작업 전에 다시 로그인해 주세요');
 const scope=user.id+':operator:'+action,previous=await replay(env,request,scope,input);if(previous)return response(previous);
 const now=new Date().toISOString(),audit=crypto.randomUUID();
 if(action==='support'){
  const reply=text(input.reply,1000,'답변');
  if(!await env.DB.prepare('SELECT id FROM w2_support WHERE id=?').bind(id).first())throw new ApiError(404,'문의를 찾을 수 없어요');
  return response(await operation(env,request,scope,input,{id,status:'resolved'},(guard,claim,mutation)=>[
   env.DB.prepare(`UPDATE w2_support SET reply=?,status='resolved' WHERE id=? AND ${guard}`).bind(reply,id,scope,mutation,claim),
   env.DB.prepare(`INSERT INTO w2_operator_actions SELECT ?,?,'support-reply',?,? WHERE ${guard} AND EXISTS(SELECT 1 FROM w2_support WHERE id=? AND status='resolved' AND reply=?)`).bind(audit,user.id,id,now,scope,mutation,claim,id,reply),
  ]));
 }
 const decision=text(input.decision,20,'처리');
 if(!['hide-entry','hold','release','dismiss'].includes(decision))throw new ApiError(400,'처리 방법을 선택해 주세요');
 const report=await env.DB.prepare('SELECT slug,entry_id FROM w2_reports WHERE id=?').bind(id).first<{slug:string;entry_id:string|null}>();
 if(!report)throw new ApiError(404,'신고를 찾을 수 없어요');
 if(decision==='hide-entry'&&!report.entry_id)throw new ApiError(400,'방명록 신고가 아니에요');
 return response(await operation(env,request,scope,input,{id,status:decision==='dismiss'?'dismissed':'reviewed'},(guard,claim,mutation)=>{
  const queries=[];
  if(decision==='hide-entry')queries.push(env.DB.prepare(`DELETE FROM w2_guestbook WHERE id=? AND slug=? AND ${guard}`).bind(report.entry_id!,report.slug,scope,mutation,claim));
  if(decision==='hold')queries.push(
   env.DB.prepare(`INSERT INTO w2_moderation_holds SELECT ?,?,? WHERE ${guard} AND EXISTS(SELECT 1 FROM w2_invitations WHERE slug=?) ON CONFLICT(slug) DO NOTHING`).bind(report.slug,id,now,scope,mutation,claim,report.slug),
   env.DB.prepare(`UPDATE w2_invitations SET public_data=NULL,public_expires_at=NULL WHERE slug=? AND ${guard}`).bind(report.slug,scope,mutation,claim),
  );
  if(decision==='release')queries.push(env.DB.prepare(`DELETE FROM w2_moderation_holds WHERE slug=? AND ${guard}`).bind(report.slug,scope,mutation,claim));
  queries.push(
   env.DB.prepare(`UPDATE w2_reports SET status=? WHERE id=? AND ${guard}`).bind(decision==='dismiss'?'dismissed':'reviewed',id,scope,mutation,claim),
   env.DB.prepare(`INSERT INTO w2_operator_actions SELECT ?,?,?,?,? WHERE ${guard} AND EXISTS(SELECT 1 FROM w2_reports WHERE id=?)`).bind(audit,user.id,decision,id,now,scope,mutation,claim,id),
  );
  return queries;
 }));
}

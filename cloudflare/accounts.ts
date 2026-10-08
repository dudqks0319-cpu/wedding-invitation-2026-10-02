import type {Env} from './types';
import {ApiError,object,text} from '../src/lib/server/validation';
import {actor,csrf,hex,json,publicQuota,quota,response,sessionGuard} from './security';
import {appleConfigured,revokeAppleAccounts} from './appleLogin';

export async function publicServiceConfig(env:Env){
 const operator=(env.WEDDING_OPERATOR_NAME??'').trim(),email=(env.WEDDING_SUPPORT_EMAIL??'').trim();
 const transfer=(env.WEDDING_PRIVACY_TRANSFER_NOTICE??'').trim(),validEmail=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email);
 const apple=await env.DB.prepare("SELECT enabled FROM w2_controls WHERE name='apple_login'").first<{enabled:number}>();
 return {operatorName:operator,supportEmail:validEmail?email:'',
  transferNotice:transfer,privacyReady:!!operator&&validEmail&&!!transfer,
  appleEnabled:apple?.enabled===1&&appleConfigured(env),billingEnabled:false};
}
export async function accountRoute(env:Env,request:Request,action:string){
 if(action==='config'&&request.method==='GET'){await publicQuota(env,request);return response(await publicServiceConfig(env));}
 const user=(await actor(env,request))!;
 if(action==='deletion'&&request.method==='DELETE'){
  csrf(env,request);const input=object(await json(request));
  if(input.confirm!=='청첩장 계정 삭제')throw new ApiError(400,'삭제 확인 문구를 정확히 입력해 주세요');
  await quota(env,user.id,'account-delete',3,86400);
  const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-osam-session=([a-f0-9]{48})(?:;|$)/)?.[1];
  const hash=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token!)));
  const session=await env.DB.prepare('SELECT created_at FROM sessions WHERE token_hash=?').bind(hash).first<{created_at:string}>();
  if(!session||Date.parse(session.created_at)<Date.now()-15*60000)throw new ApiError(403,'계정 삭제 전에 로그아웃 후 다시 로그인해 주세요');
  const now=new Date().toISOString();
  const identity=await env.DB.prepare('SELECT subject FROM w2_apple_identities WHERE owner_id=?').bind(user.id).first<{subject:string}>();
  const subjectHash=identity?hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity.subject))):'';
  // One transaction closes public data and old sessions before physical R2/Apple cleanup.
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO w2_account_deletions(owner_id,requested_at,state,apple_only)
    SELECT ?,?,'pending',EXISTS(SELECT 1 FROM w2_apple_identities WHERE owner_id=?)
    ON CONFLICT(owner_id) DO UPDATE SET requested_at=excluded.requested_at,state='pending',apple_only=MAX(apple_only,excluded.apple_only)`).bind(user.id,now,user.id),
   env.DB.prepare('INSERT INTO w2_apple_revocations SELECT owner_id,refresh_cipher,?,? FROM w2_apple_identities WHERE owner_id=? ON CONFLICT(owner_id) DO NOTHING').bind(now,subjectHash,user.id),
   env.DB.prepare("UPDATE w2_photos SET state='deleting' WHERE owner_id=?").bind(user.id),
   env.DB.prepare(`DELETE FROM w2_operations WHERE substr(scope,1,6)='guest:' AND
    EXISTS(SELECT 1 FROM w2_invitations i WHERE i.owner_id=? AND substr(w2_operations.scope,72,length(i.slug)+1)=i.slug||':')`).bind(user.id),
   env.DB.prepare('DELETE FROM w2_invitations WHERE owner_id=?').bind(user.id),
   env.DB.prepare('DELETE FROM w2_support WHERE owner_id=?').bind(user.id),
   env.DB.prepare('UPDATE w2_apple_transactions SET owner_id=NULL WHERE owner_id=?').bind(user.id),
   env.DB.prepare('DELETE FROM w2_billing_accounts WHERE owner_id=?').bind(user.id),
   env.DB.prepare('DELETE FROM w2_operations WHERE substr(scope,1,length(?))=?').bind(user.id+':',user.id+':'),
   env.DB.prepare('DELETE FROM sessions WHERE token_hash=? OR token_hash IN(SELECT token_hash FROM w2_session_links WHERE owner_id=?)').bind(hash,user.id),
   env.DB.prepare('DELETE FROM w2_session_links WHERE owner_id=?').bind(user.id),
   env.DB.prepare('DELETE FROM w2_apple_identities WHERE owner_id=?').bind(user.id),
  ]);
  const res=response({deleted:true,physicalCleanup:'pending',legacyDataPreserved:true});
  res.headers.set('Set-Cookie','__Host-osam-session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');return res;
 }
 if(action==='support'){
  if(request.method==='GET')return response((await env.DB.prepare('SELECT id,category,message,status,reply,created_at AS createdAt FROM w2_support WHERE owner_id=? ORDER BY created_at DESC LIMIT 20').bind(user.id).all()).results);
  if(request.method!=='POST')throw new ApiError(405,'지원하지 않는 요청이에요');
  const idempotency=csrf(env,request),input=object(await json(request));
  const category=text(input.category,30,'문의 유형'),message=text(input.message,1000,'문의 내용');
  if(!['login','photo','sharing','purchase','privacy','other'].includes(category))throw new ApiError(400,'문의 유형을 선택해 주세요');
  const enabled=await env.DB.prepare("SELECT enabled FROM w2_controls WHERE name='support'").first<{enabled:number}>();
  if(enabled?.enabled!==1)throw new ApiError(503,'문의 접수를 잠시 점검 중이에요');
  await quota(env,user.id,'support',3,86400);await quota(env,'global','support',100,86400);
  const accountGuard=await sessionGuard(request);
  await env.DB.prepare(`INSERT INTO w2_support(id,owner_id,category,message,created_at,mutation_id)
   SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM w2_support WHERE owner_id=?)<20
   AND (SELECT COUNT(*) FROM w2_support)<5000
   AND ${accountGuard}
   ON CONFLICT(owner_id,mutation_id) DO NOTHING`).bind(crypto.randomUUID(),user.id,category,message,new Date().toISOString(),idempotency,user.id).run();
  const row=await env.DB.prepare('SELECT id,category,message,status FROM w2_support WHERE owner_id=? AND mutation_id=?').bind(user.id,idempotency).first<{id:string;category:string;message:string;status:string}>();
  if(!row)throw new ApiError(429,'문의 접수 한도에 도달했어요. 기존 문의의 답변을 기다려 주세요');
  if(row.category!==category||row.message!==message)throw new ApiError(409,'같은 요청 번호에 다른 문의 내용이 있어요');
  return response({id:row.id,status:row.status},201);
 }
 throw new ApiError(404,'요청을 찾을 수 없어요');
}
export async function cleanupAccounts(env:Env){
 await revokeAppleAccounts(env);
 const now=new Date().toISOString(),past=new Date(Date.now()-90*86400000).toISOString();
 await env.DB.batch([
  env.DB.prepare('DELETE FROM w2_apple_flows WHERE id IN(SELECT id FROM w2_apple_flows WHERE expires_at<? LIMIT 500)').bind(Date.now()),
  env.DB.prepare('DELETE FROM w2_session_links WHERE token_hash IN(SELECT l.token_hash FROM w2_session_links l LEFT JOIN sessions s ON s.token_hash=l.token_hash WHERE s.token_hash IS NULL OR s.expires_at<? LIMIT 500)').bind(now),
  env.DB.prepare('DELETE FROM w2_support WHERE id IN(SELECT id FROM w2_support WHERE created_at<? LIMIT 100)').bind(past),
  env.DB.prepare('DELETE FROM w2_reports WHERE id IN(SELECT id FROM w2_reports WHERE created_at<? LIMIT 100)').bind(past),
  env.DB.prepare('DELETE FROM w2_operator_actions WHERE id IN(SELECT id FROM w2_operator_actions WHERE created_at<? LIMIT 100)').bind(past),
  env.DB.prepare(`UPDATE w2_account_deletions SET state='complete' WHERE state='pending'
   AND NOT EXISTS(SELECT 1 FROM w2_photos WHERE owner_id=w2_account_deletions.owner_id)
   AND NOT EXISTS(SELECT 1 FROM w2_apple_revocations WHERE owner_id=w2_account_deletions.owner_id)`),
 ]);
 const appleOwners=(await env.DB.prepare("SELECT owner_id FROM w2_account_deletions WHERE state='complete' AND apple_only=1 LIMIT 50").all<{owner_id:string}>()).results;
 for(const row of appleOwners)try{
  // Apple creates independent IDs. Never erase an ID still used by the legacy product.
  await env.DB.prepare(`DELETE FROM users WHERE id=? AND email IS NULL
   AND NOT EXISTS(SELECT 1 FROM account_identities WHERE user_id=users.id)
   AND NOT EXISTS(SELECT 1 FROM invitations WHERE owner_id=users.id)
   AND NOT EXISTS(SELECT 1 FROM media_assets WHERE owner_id=users.id)
   AND NOT EXISTS(SELECT 1 FROM sessions WHERE user_id=users.id)
   AND NOT EXISTS(SELECT 1 FROM native_auth_tickets WHERE user_id=users.id)`).bind(row.owner_id).run();
 }catch{console.error('w2_account_cleanup_retry');}
 await env.DB.prepare(`DELETE FROM w2_account_deletions WHERE owner_id IN(
  SELECT d.owner_id FROM w2_account_deletions d WHERE d.state='complete' AND d.requested_at<?
  AND (d.apple_only=0 OR NOT EXISTS(SELECT 1 FROM users WHERE id=d.owner_id)) LIMIT 100)`).bind(past).run();
}

import type {Env} from './types';
import {hex} from './security';
import {ApiError,safeNext} from '../src/lib/server/validation';
import {WEDDING_ORIGIN} from './authBridge';

export async function createServiceSession(env:Env,owner:string,next:unknown='/my') {
 const token=hex(crypto.getRandomValues(new Uint8Array(24)).buffer);
 const hash=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));
 const now=new Date(),created=now.toISOString();
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO sessions(token_hash,user_id,created_at,expires_at)
   SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM w2_account_deletions WHERE owner_id=? AND state='pending')`)
   .bind(hash,owner,created,new Date(now.getTime()+30*86400000).toISOString(),owner),
  env.DB.prepare('INSERT INTO w2_session_links SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM sessions WHERE token_hash=?)').bind(hash,owner,created,hash),
 ]);
 if(!await env.DB.prepare('SELECT token_hash FROM w2_session_links WHERE token_hash=?').bind(hash).first())throw new ApiError(409,'계정 자료를 삭제 중이에요. 삭제가 끝난 뒤 다시 시작해 주세요');
 return new Response(null,{status:303,headers:{Location:new URL(safeNext(next),WEDDING_ORIGIN).href,
  'Cache-Control':'no-store','Referrer-Policy':'no-referrer',
  'Set-Cookie':`__Host-osam-session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30*86400}`}});
}

import type {Env} from './types';
import {ApiError,object,text} from '../src/lib/server/validation';
import {csrf,hex,json,publicQuota,quota,response} from './security';
import {createServiceSession} from './serviceSession';

const CLIENT_ID='com.invitehub.wedding-preview',ISSUER='https://appleid.apple.com';
const encode=new TextEncoder();
const b64=(value:Uint8Array)=>btoa(String.fromCharCode(...value)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
function decode(value:string){
 if(!/^[A-Za-z0-9_-]+$/.test(value))throw new ApiError(401,'Apple 인증을 다시 시작해 주세요');
 return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
}
const hash=async(value:string)=>hex(await crypto.subtle.digest('SHA-256',encode.encode(value)));
type AppleKey=JsonWebKey&{kid:string};
type Claims={iss:string;aud:string;sub:string;exp:number;iat:number;nonce:string};
let cachedKeys:{keys:AppleKey[];until:number}|undefined;
let pendingKeys:Promise<AppleKey[]>|undefined;
async function appleJSON(path:string,init?:RequestInit){
 const res=await fetch(ISSUER+path,{...init,signal:AbortSignal.timeout(10000),redirect:'error'});
 if(!res.ok||!res.body)throw new ApiError(503,'Apple 연결을 확인하고 있어요. 다시 시도해 주세요');
 const reader=res.body.getReader(),chunks:Uint8Array[]=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>65536)throw new ApiError(503,'Apple 응답을 확인하고 있어요');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const data=new Uint8Array(length);let offset=0;for(const part of chunks){data.set(part,offset);offset+=part.length;}
 try{return object(JSON.parse(new TextDecoder().decode(data)));}catch{throw new ApiError(503,'Apple 응답을 확인하고 있어요');}
}
async function keys(){
 if(cachedKeys&&cachedKeys.until>Date.now())return cachedKeys.keys;
 if(!pendingKeys)pendingKeys=(async()=>{const value=await appleJSON('/auth/keys');
  if(!Array.isArray(value.keys)||value.keys.length>10)throw new ApiError(503,'Apple 인증 설정을 확인하고 있어요');
  const keys=value.keys as AppleKey[];cachedKeys={keys,until:Date.now()+3600000};return keys;
 })().finally(()=>{pendingKeys=undefined;});
 return pendingKeys;
}
/** Only Apple's fixed key endpoint may provide keys; no token-supplied URL is followed. */
export async function verifyAppleIdentity(token:string,nonceHash:string,audience:string,keySet:AppleKey[]):Promise<Claims>{
 try{
  if(token.length>8192)throw new Error('size');
  const parts=token.split('.');if(parts.length!==3)throw new Error('format');
  const header=object(JSON.parse(new TextDecoder().decode(decode(parts[0]))));
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.jku||header.jwk||header.x5u||header.crit)throw new Error('algorithm');
  const key=keySet.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.alg==='RS256'&&k.use==='sig');if(!key)throw new Error('key');
  const publicKey=await crypto.subtle.importKey('jwk',key,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',publicKey,decode(parts[2]),encode.encode(parts[0]+'.'+parts[1])))throw new Error('signature');
  const c=object(JSON.parse(new TextDecoder().decode(decode(parts[1])))),now=Math.floor(Date.now()/1000);
  if(c.iss!==ISSUER||c.aud!==audience||typeof c.sub!=='string'||!c.sub||c.sub.length>256||
   !Number.isSafeInteger(c.exp)||(c.exp as number)<=now||!Number.isSafeInteger(c.iat)||(c.iat as number)>now+60||
   typeof c.nonce!=='string'||c.nonce.length>128||await hash(c.nonce)!==nonceHash)throw new Error('claims');
  return c as Claims;
 }catch{throw new ApiError(401,'Apple 인증을 다시 시작해 주세요');}
}
export function appleConfigured(env:Env){
 try{
  const parts=env.APPLE_CLIENT_SECRET?.split('.');if(parts?.length!==3)return false;
  const c=object(JSON.parse(new TextDecoder().decode(decode(parts[1]))));
  return c.sub===CLIENT_ID&&c.iss==='3FG9QJC8WC'&&c.aud===ISSUER&&typeof c.exp==='number'&&c.exp>Date.now()/1000+60&&
   !!env.APPLE_TOKEN_ENCRYPTION_KEY&&/^[A-Za-z0-9+/]{43}=$/.test(env.APPLE_TOKEN_ENCRYPTION_KEY);
 }catch{return false;}
}
async function encryptionKey(env:Env){
 if(!env.APPLE_TOKEN_ENCRYPTION_KEY)throw new ApiError(503,'Apple 계정 설정을 준비 중이에요');
 const raw=Uint8Array.from(atob(env.APPLE_TOKEN_ENCRYPTION_KEY),c=>c.charCodeAt(0));
 if(raw.length!==32)throw new ApiError(503,'Apple 계정 설정을 준비 중이에요');
 return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
}
async function seal(env:Env,token:string,owner:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encode.encode(owner)},await encryptionKey(env),encode.encode(token));
 return b64(iv)+'.'+b64(new Uint8Array(cipher));
}
async function unseal(env:Env,cipher:string,owner:string){
 const [iv,data]=cipher.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt(
  {name:'AES-GCM',iv:decode(iv),additionalData:encode.encode(owner)},await encryptionKey(env),decode(data)));
}
export async function appleRoute(env:Env,request:Request,action:string){
 if(request.method!=='POST')throw new ApiError(405,'지원하지 않는 요청이에요');
 csrf(env,request);await publicQuota(env,request,true);await quota(env,'global','apple-auth',1000,86400);
 const enabled=await env.DB.prepare("SELECT enabled FROM w2_controls WHERE name='apple_login'").first<{enabled:number}>();
 if(enabled?.enabled!==1||!appleConfigured(env))throw new ApiError(503,'Apple 로그인을 준비 중이에요. 다른 로그인으로 시작할 수 있어요');
 const input=object(await json(request));
 if(action==='challenge'){
  const id=crypto.randomUUID(),nonce=hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  await env.DB.prepare('INSERT INTO w2_apple_flows SELECT ?,?,? WHERE (SELECT COUNT(*) FROM w2_apple_flows WHERE expires_at>?)<1000').bind(id,await hash(nonce),Date.now()+300000,Date.now()).run();
  if(!await env.DB.prepare('SELECT id FROM w2_apple_flows WHERE id=?').bind(id).first())throw new ApiError(429,'로그인 요청이 많아요. 다시 시도해 주세요');
  return response({id,nonce});
 }
 if(action!=='complete')throw new ApiError(404,'요청을 찾을 수 없어요');
 const flowId=text(input.flowId,36,'인증'),token=text(input.identityToken,8192,'인증'),code=text(input.authorizationCode,2048,'인증');
 const flow=await env.DB.prepare('SELECT nonce_hash FROM w2_apple_flows WHERE id=? AND expires_at>?').bind(flowId,Date.now()).first<{nonce_hash:string}>();
 if(!flow)throw new ApiError(401,'Apple 인증을 다시 시작해 주세요');
 const identity=await verifyAppleIdentity(token,flow.nonce_hash,CLIENT_ID,await keys());
 const subjectHash=await hash(identity.sub);
 if(await env.DB.prepare('SELECT owner_id FROM w2_apple_revocations WHERE subject_hash=?').bind(subjectHash).first())throw new ApiError(409,'이전 계정의 삭제 처리가 진행 중이에요. 완료 후 다시 로그인해 주세요');
 const used=await env.DB.prepare('DELETE FROM w2_apple_flows WHERE id=? AND nonce_hash=? AND expires_at>? RETURNING id').bind(flowId,flow.nonce_hash,Date.now()).first();
 if(!used)throw new ApiError(401,'Apple 인증을 다시 시작해 주세요');
 const exchange=await appleJSON('/auth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({client_id:CLIENT_ID,client_secret:env.APPLE_CLIENT_SECRET!,code,grant_type:'authorization_code'})});
 if(typeof exchange.id_token!=='string'||typeof exchange.refresh_token!=='string'||exchange.refresh_token.length>4096)throw new ApiError(401,'Apple 인증을 다시 시작해 주세요');
 const exchanged=await verifyAppleIdentity(exchange.id_token,flow.nonce_hash,CLIENT_ID,await keys());
 if(exchanged.sub!==identity.sub)throw new ApiError(401,'Apple 인증을 다시 시작해 주세요');
 // Subject, never email, identifies the account. Apple identities are independent of legacy products.
 let account=await env.DB.prepare('SELECT owner_id FROM w2_apple_identities WHERE subject=?').bind(identity.sub).first<{owner_id:string}>();
 if(!account){
  const owner=crypto.randomUUID(),cipher=await seal(env,exchange.refresh_token,owner);
  await env.DB.batch([
   env.DB.prepare('INSERT INTO users(id,email,created_at) VALUES(?,NULL,?)').bind(owner,new Date().toISOString()),
   env.DB.prepare('INSERT INTO w2_apple_identities SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM w2_apple_revocations WHERE subject_hash=?) ON CONFLICT(subject) DO NOTHING').bind(identity.sub,owner,cipher,subjectHash),
   env.DB.prepare('DELETE FROM users WHERE id=? AND NOT EXISTS(SELECT 1 FROM w2_apple_identities WHERE owner_id=?)').bind(owner,owner),
  ]);
  account=await env.DB.prepare('SELECT owner_id FROM w2_apple_identities WHERE subject=?').bind(identity.sub).first<{owner_id:string}>();
 }
 if(!account)throw new ApiError(503,'계정 연결을 다시 시도해 주세요');
 await env.DB.prepare(`UPDATE w2_apple_identities SET refresh_cipher=? WHERE subject=? AND
  NOT EXISTS(SELECT 1 FROM w2_account_deletions WHERE owner_id=? AND state='pending')`).bind(await seal(env,exchange.refresh_token,account.owner_id),identity.sub,account.owner_id).run();
 return createServiceSession(env,account.owner_id);
}
export async function revokeAppleAccounts(env:Env){
 if(!appleConfigured(env))return;
 const rows=(await env.DB.prepare('SELECT owner_id,refresh_cipher FROM w2_apple_revocations ORDER BY created_at LIMIT 2').all<{owner_id:string;refresh_cipher:string}>()).results;
 for(const row of rows)try{
  const token=await unseal(env,row.refresh_cipher,row.owner_id);
  const res=await fetch(ISSUER+'/auth/revoke',{method:'POST',signal:AbortSignal.timeout(10000),redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({client_id:CLIENT_ID,client_secret:env.APPLE_CLIENT_SECRET!,token,token_type_hint:'refresh_token'})});
  if(res.status===200)await env.DB.prepare('DELETE FROM w2_apple_revocations WHERE owner_id=? AND refresh_cipher=?').bind(row.owner_id,row.refresh_cipher).run();
  await res.body?.cancel();
 }catch{console.error('w2_apple_revocation_retry');}
}

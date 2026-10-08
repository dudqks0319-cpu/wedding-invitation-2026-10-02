import type {Env} from './types';
import {ApiError,safeNext,object,text} from '../src/lib/server/validation';
import {csrf,hex,json,publicQuota,quota,response} from './security';
import {createServiceSession} from './serviceSession';

export const WEDDING_ORIGIN='https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site';
export const LEGACY_ORIGIN='https://osamosam-app.jyb1126.chatgpt.site';
export const WEDDING_NATIVE_CALLBACK='com.invitehub.wedding-preview://auth';
const flowCookie='__Host-w2-login',bridgeCookie='__Host-w2-bridge';
const digest=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
const random=(bytes:number)=>hex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
export async function challenge(verifier:string){return btoa(String.fromCharCode(...await digest(verifier))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function cookie(request:Request,name:string){return request.headers.get('cookie')?.split(';').map(p=>p.trim()).find(p=>p.startsWith(name+'='))?.slice(name.length+1);}
function setCookie(name:string,value:string,age:number){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;}
function redirect(url:URL){return new Response(null,{status:303,headers:{Location:url.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}
async function authQuota(env:Env,request:Request){await publicQuota(env,request,true);await quota(env,'global','auth-bridge',2000,86400);}

/** Existing OAuth registration authenticates; a browser-bound, single-use ticket returns here. */
export async function startWeddingLogin(env:Env,request:Request){
 csrf(env,request);await authQuota(env,request);
 const input=object(await json(request)),provider=text(input.provider,10,'로그인');
 if(!['google','kakao'].includes(provider))throw new ApiError(400,'카카오 또는 Google로 로그인해 주세요');
 const verifier=random(32),state=random(32),next=safeNext(input.next);
 const url=new URL(`/auth/wedding/${provider}`,LEGACY_ORIGIN);
 url.search=new URLSearchParams({challenge:await challenge(verifier),state}).toString();
 const result=response({url:url.href});
 result.headers.set('Set-Cookie',setCookie(flowCookie,encodeURIComponent(JSON.stringify({verifier,state,next,until:Date.now()+600000})),600));
 result.headers.set('Referrer-Policy','no-referrer');return result;
}

/** Only on the old registered origin; ordinary native and legacy OAuth remain unchanged. */
export function weddingBridgeRequest(request:Request):Response|null{
 const url=new URL(request.url),match=url.pathname.match(/^\/auth\/wedding\/(google|kakao)$/);
 if(!match)return null;
 const c=url.searchParams.get('challenge'),s=url.searchParams.get('state');
 const native=url.searchParams.get('native');
 if(request.method!=='GET'||!c||!/^[A-Za-z0-9_-]{43}$/.test(c)||!s||!/^[a-f0-9]{64}$/.test(s)||
  (native!==null&&native!=='1')||[...url.searchParams.keys()].length!==(native==='1'?3:2))return response({error:'로그인을 다시 시작해 주세요'},400);
 const target=new URL(`/auth/${match[1]}`,LEGACY_ORIGIN);
 target.search=new URLSearchParams({native_challenge:c,native_state:s}).toString();
 const result=redirect(target);result.headers.set('Set-Cookie',setCookie(bridgeCookie,(native==='1'?'native.':'')+s,600));return result;
}

export function weddingBridgeReturn(request:Request,result:Response):Response{
 if(!/^\/auth\/(google|kakao)\/callback$/.test(new URL(request.url).pathname))return result;
 const stored=cookie(request,bridgeCookie),native=stored?.startsWith('native.')===true;
 const bound=native?stored?.slice(7):stored,location=result.headers.get('Location');
 if(!bound||!/^[a-f0-9]{64}$/.test(bound)||!location)return result;
 const target=new URL(location,LEGACY_ORIGIN);
 let next:URL;
 if(target.protocol==='com.invitehub.app:'&&target.host==='auth'&&target.searchParams.get('state')===bound&&/^[a-f0-9]{48}$/.test(target.searchParams.get('code')??'')&&[...target.searchParams.keys()].length===2){
  next=native?new URL(WEDDING_NATIVE_CALLBACK):new URL('/api/v2/auth/complete',WEDDING_ORIGIN);next.search=target.search;
 }else if(target.origin===LEGACY_ORIGIN&&target.pathname==='/login'&&target.searchParams.get('expired')==='1'){
  next=native?new URL(WEDDING_NATIVE_CALLBACK):new URL('/login',WEDDING_ORIGIN);next.search='?expired=1';
 }
 else return result;
 const headers=new Headers(result.headers);headers.set('Location',next.href);headers.set('Cache-Control','no-store');headers.set('Referrer-Policy','no-referrer');
 headers.append('Set-Cookie',setCookie(bridgeCookie,'',0));return new Response(null,{status:303,headers});
}

/** A native attempt owns its verifier; no app session is placed in a callback URL. */
export async function startNativeWeddingLogin(env:Env,request:Request){
 await authQuota(env,request);
 const url=new URL(request.url),provider=url.searchParams.get('provider'),c=url.searchParams.get('challenge'),state=url.searchParams.get('state');
 if(request.method!=='GET'||!['google','kakao'].includes(provider??'')||!c||!/^[A-Za-z0-9_-]{43}$/.test(c)||!state||!/^[a-f0-9]{64}$/.test(state)||
  [...url.searchParams.keys()].length!==3)throw new ApiError(400,'로그인을 다시 시작해 주세요');
 const target=new URL(`/auth/wedding/${provider}`,LEGACY_ORIGIN);
 target.search=new URLSearchParams({challenge:c,state,native:'1'}).toString();
 return redirect(target);
}

export async function redeemNativeWeddingLogin(env:Env,request:Request){
 csrf(env,request);await authQuota(env,request);
 const input=object(await json(request)),code=input.code,verifier=input.verifier,state=input.state;
 if(request.method!=='POST'||Object.keys(input).some(k=>!['code','verifier','state','next'].includes(k))||
  typeof code!=='string'||!/^[a-f0-9]{48}$/.test(code)||typeof verifier!=='string'||!/^[a-f0-9]{64}$/.test(verifier)||
  typeof state!=='string'||!/^[a-f0-9]{64}$/.test(state))throw new ApiError(400,'로그인을 다시 시작해 주세요');
 const ticket=await env.DB.prepare(`DELETE FROM native_auth_tickets WHERE code_hash=? AND challenge=? AND state=? AND expires_at>?
  AND NOT EXISTS(SELECT 1 FROM deletion_jobs WHERE owner_id=native_auth_tickets.user_id AND state<>'complete') RETURNING user_id`)
  .bind(hex((await digest(code)).buffer),await challenge(verifier),state,new Date().toISOString()).first<{user_id:string}>();
 if(!ticket)throw new ApiError(401,'로그인이 만료됐어요. 다시 시작해 주세요');
 return createServiceSession(env,ticket.user_id,input.next);
}

export async function completeWeddingLogin(env:Env,request:Request){
 const failure=()=>{const r=redirect(new URL('/login?expired=1',WEDDING_ORIGIN));r.headers.set('Set-Cookie',setCookie(flowCookie,'',0));return r;};
 try{
  await authQuota(env,request);
  const url=new URL(request.url),code=url.searchParams.get('code'),state=url.searchParams.get('state'),raw=cookie(request,flowCookie);
  if(request.method!=='GET'||!code||!/^[a-f0-9]{48}$/.test(code)||!state||!/^[a-f0-9]{64}$/.test(state)||!raw||raw.length>4096||[...url.searchParams.keys()].length!==2)return failure();
  const flow=JSON.parse(decodeURIComponent(raw)) as {verifier:string;state:string;next:string;until:number};
  if(!/^[a-f0-9]{64}$/.test(flow.verifier)||flow.state!==state||!Number.isSafeInteger(flow.until)||flow.until<Date.now()||flow.until>Date.now()+600000)return failure();
  const ticket=await env.DB.prepare(`DELETE FROM native_auth_tickets WHERE code_hash=? AND challenge=? AND state=? AND expires_at>?
   AND NOT EXISTS(SELECT 1 FROM deletion_jobs WHERE owner_id=native_auth_tickets.user_id AND state<>'complete') RETURNING user_id`)
   .bind(hex((await digest(code)).buffer),await challenge(flow.verifier),state,new Date().toISOString()).first<{user_id:string}>();
  if(!ticket)return failure();
  const result=await createServiceSession(env,ticket.user_id,flow.next);
  result.headers.append('Set-Cookie',setCookie(flowCookie,'',0));return result;
 }catch{return failure();}
}

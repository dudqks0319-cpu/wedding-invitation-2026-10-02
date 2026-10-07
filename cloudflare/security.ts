import {ApiError} from '../src/lib/server/validation';
import type {Env,Query} from './types';
const encode=new TextEncoder();
export const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
export async function hmac(env:Env,value:string){
 if(!env.ABUSE_HMAC_SECRET||env.ABUSE_HMAC_SECRET.length<32)throw new ApiError(503,'서비스 연결을 점검 중이에요. 잠시 후 다시 시도해 주세요');
 const key=await crypto.subtle.importKey('raw',encode.encode(env.ABUSE_HMAC_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,encode.encode(value)));
}
export async function actor(env:Env,request:Request,required=true){
 const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-osam-session='))?.split('=')[1];
 if(!token||!/^[a-f0-9]{48}$/.test(token)){if(required)throw new ApiError(401,'로그인해 주세요');return null;}
 const hash=hex(await crypto.subtle.digest('SHA-256',encode.encode(token)));
 const user=await env.DB.prepare(`SELECT user_id AS id FROM sessions WHERE token_hash=? AND expires_at>?
 AND NOT EXISTS(SELECT 1 FROM deletion_jobs WHERE owner_id=sessions.user_id AND state<>'complete')`).bind(hash,new Date().toISOString()).first<{id:string}>();
 if(!user&&required)throw new ApiError(401,'다시 로그인해 주세요');
 return user;
}
export async function quota(env:Env,scope:string,action:string,limit:number,seconds:number,amount=1){
 const now=Math.floor(Date.now()/1000),window=Math.floor(now/seconds)*seconds;
 const row=await env.DB.prepare(`INSERT INTO w2_limits VALUES(?,?,?,?,?)
 ON CONFLICT(scope,action,window) DO UPDATE SET hits=hits+excluded.hits WHERE hits+excluded.hits<=?
 RETURNING hits`).bind(scope,action,window,amount,window+seconds,limit).first();
 if(!row)throw new ApiError(429,'요청이 많아요. 잠시 후 다시 시도해 주세요');
}
export async function publicQuota(env:Env,request:Request,write=false){
 const ip=request.headers.get('cf-connecting-ip');
 if(!ip||!/^[a-fA-F0-9:.]{3,64}$/.test(ip))throw new ApiError(503,'연결을 확인하고 다시 시도해 주세요');
 // Only Cloudflare's peer or the verified gateway can supply this header.
 const key=await hmac(env,`ip:${Math.floor(Date.now()/86400000)}:${ip}`);
 await quota(env,key,write?'guest-write':'read',write?12:300,60);
 await quota(env,'global',write?'guest-write':'read',write?2000:50000,86400);
 return key;
}
export async function bytes(request:Request,max:number){
 const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'입력을 확인해 주세요');
 const parts:Uint8Array[]=[];let size=0;
 // Uploads have a longer total deadline than small JSON writes; chunks never reset it.
 const deadline=Date.now()+(max>65536?60000:15000);let complete=false;
 try{
  for(;;){
   const remaining=deadline-Date.now();
   if(remaining<=0||request.signal.aborted)throw new ApiError(408,'전송 시간이 초과되었어요. 다시 시도해 주세요');
   let timer:ReturnType<typeof setTimeout>|undefined,abort:(()=>void)|undefined;
   try{
    const stopped=new Promise<never>((_,reject)=>{
     abort=()=>reject(new ApiError(408,'전송이 중단되었어요. 다시 시도해 주세요'));
     request.signal.addEventListener('abort',abort,{once:true});
     timer=setTimeout(()=>reject(new ApiError(408,'전송 시간이 초과되었어요. 다시 시도해 주세요')),remaining);
    });
    const v=await Promise.race([reader.read(),stopped]);if(v.done){complete=true;break;}
    size+=v.value.byteLength;if(size>max)throw new ApiError(413,'파일 또는 입력이 너무 커요');parts.push(v.value);
   }finally{clearTimeout(timer);if(abort)request.signal.removeEventListener('abort',abort);}
  }
 }finally{if(!complete)void reader.cancel().catch(()=>{});reader.releaseLock();}
 const output=new Uint8Array(size);let offset=0;for(const p of parts){output.set(p,offset);offset+=p.length;}return output;
}
export async function json(request:Request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ApiError(415,'입력 형식을 확인해 주세요');
 try{return JSON.parse(new TextDecoder().decode(await bytes(request,65536)));}catch(e){if(e instanceof ApiError)throw e;throw new ApiError(400,'입력을 확인해 주세요');}
}
export function csrf(env:Env,request:Request){
 const origin=new URL(env.NEXT_PUBLIC_SITE_URL??request.url).origin;
 if(request.headers.get('origin')!==origin)throw new ApiError(403,'이 사이트에서 다시 시도해 주세요');
 const id=request.headers.get('idempotency-key');
 if(!id||!/^[a-f0-9-]{36}$/.test(id))throw new ApiError(400,'요청 번호를 확인해 주세요');return id;
}
export async function operation(env:Env,request:Request,scope:string,input:unknown,result:unknown,mutations:(guard:string,claim:string,id:string)=>Query[]){
 const id=csrf(env,request),fingerprint=await hmac(env,JSON.stringify(input)),claim=crypto.randomUUID();
 const guard='EXISTS(SELECT 1 FROM w2_operations WHERE scope=? AND id=? AND claim=?)';
 await env.DB.batch([
  env.DB.prepare('INSERT INTO w2_operations VALUES(?,?,?,?,?,?) ON CONFLICT(scope,id) DO NOTHING').bind(scope,id,fingerprint,claim,'pending',Date.now()+86400000),
  ...mutations(guard,claim,id),
  env.DB.prepare(`UPDATE w2_operations SET result=CASE WHEN changes()>0 THEN ? ELSE '{"conflict":true}' END WHERE scope=? AND id=? AND claim=? AND result=?`).bind(JSON.stringify(result),scope,id,claim,'pending'),
 ]);
 const row=await env.DB.prepare('SELECT fingerprint,result FROM w2_operations WHERE scope=? AND id=?').bind(scope,id).first<{fingerprint:string;result:string}>();
 if(row?.fingerprint!==fingerprint)throw new ApiError(409,'같은 요청 번호에 다른 내용이 있어요');
 if(row.result==='pending')throw new ApiError(409,'처리 중이에요. 잠시 후 다시 시도해 주세요');
 const output=JSON.parse(row.result);if(output.conflict)throw new ApiError(409,'다른 곳에서 변경됐어요. 다시 불러온 뒤 저장해 주세요');return output;
}
export async function replay(env:Env,request:Request,scope:string,input:unknown){
 const id=csrf(env,request),row=await env.DB.prepare('SELECT fingerprint,result FROM w2_operations WHERE scope=? AND id=?').bind(scope,id).first<{fingerprint:string;result:string}>();
 if(!row)return null;
 if(row.fingerprint!==await hmac(env,JSON.stringify(input)))throw new ApiError(409,'같은 요청 번호에 다른 내용이 있어요');
 if(row.result==='pending')throw new ApiError(409,'처리 중이에요. 잠시 후 다시 시도해 주세요');
 const result=JSON.parse(row.result);if(result.conflict)throw new ApiError(409,'다른 곳에서 변경됐어요. 다시 불러와 주세요');return result;
}
export const response=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

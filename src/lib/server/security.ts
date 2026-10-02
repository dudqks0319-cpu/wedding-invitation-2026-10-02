import 'server-only';
import {createHash,createHmac,randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {ApiError} from './validation';
import {backendConfig,rpc} from './supabase';

export const digest=(value: string | Buffer)=>createHash('sha256').update(value).digest('hex');
export function fingerprint(value: string) {
  backendConfig();
  return createHmac('sha256',process.env.ABUSE_HASH_SECRET!).update(value).digest('hex');
}
export function checkOrigin(request: Request) {
  const expected=new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin;
  if(request.headers.get('origin') !== expected || request.headers.get('sec-fetch-site') === 'cross-site') throw new ApiError(403,'이 사이트에서 다시 요청해 주세요');
}
export async function boundedBody(request: Request, max=65536): Promise<Buffer> {
  const length=request.headers.get('content-length');
  if(length && (!/^\d+$/.test(length) || Number(length)>max)) throw new ApiError(413,'파일이나 입력 내용이 너무 커요');
  if(!request.body) return Buffer.alloc(0);
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
  let timer:ReturnType<typeof setTimeout>;
  const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new ApiError(408,'입력 시간이 초과됐어요')),5000);});
  try { while(true) {const {value,done}=await Promise.race([reader.read(),deadline]);if(done)break;bytes+=value.byteLength;if(bytes>max)throw new ApiError(413,'파일이나 입력 내용이 너무 커요');chunks.push(value);} }
  finally {clearTimeout(timer!);void reader.cancel().catch(()=>{});}
  return Buffer.concat(chunks);
}
export async function jsonBody(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(400,'JSON 입력이 필요해요');
  const buffer=await boundedBody(request);
  try {return JSON.parse(buffer.toString('utf8'));} catch {throw new ApiError(400,'입력 내용을 확인해 주세요');}
}
export async function limits(request: Request, action: string, userId?: string, bytes=0) {
  const trusted=process.env.TRUSTED_PROXY_HEADER;
  const proxy=['x-vercel-forwarded-for','cf-connecting-ip'].includes(trusted || '') ? request.headers.get(trusted!) : null;
  // Without a verified edge header all guests share a conservative bucket, so forged XFF cannot rotate identity.
  const actor=fingerprint(proxy || 'unverified-edge');
  const rules=[{actor:`${action}:${actor}`,seconds:60,max:20,amount:1},{actor:`${action}:${actor}`,seconds:86400,max:200,amount:1},{actor:`global:${action}`,seconds:60,max:100,amount:1},{actor:`global:${action}`,seconds:86400,max:2000,amount:1}];
  if(userId)rules.push({actor:`${action}:user:${fingerprint(userId)}`,seconds:86400,max:100,amount:1});
  if(bytes)rules.push({actor:'global:upload-bytes',seconds:86400,max:50*1024*1024,amount:bytes},{actor:`storage:user:${fingerprint(userId!)}`,seconds:2147483647,max:100*1024*1024,amount:bytes},{actor:'global:stored-bytes',seconds:2147483647,max:500*1024*1024,amount:bytes});
  await rpc('consume_limits',{limits:rules});
}
export async function idempotent<T>(request: Request, scope: string, payload: unknown, work:(id:string)=>Promise<T>):Promise<T> {
  const key=request.headers.get('idempotency-key');
  if(!key || !/^[a-f0-9-]{36}$/i.test(key))throw new ApiError(400,'중복 방지 요청 키가 필요해요');
  const writeKey=fingerprint(`${scope}:${key}`),hash=digest(JSON.stringify(payload));
  const result=await rpc<{replay:boolean;response:T}>('begin_write',{write_key:writeKey,payload_hash:hash});
  if(result.replay)return result.response;
  const h=writeKey.slice(0,32); const id=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
  const response=await work(id);
  await rpc('finish_write',{write_key:writeKey,result:response});
  return response;
}
const derive=promisify(scrypt);
export async function hashPassword(password: string) {
  const salt=randomBytes(16).toString('hex');
  const key=await derive(password,salt,64) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password:string,hash:string) {
  if(password.length<4 || password.length>64)return false;
  const [algorithm,salt,hex]=hash.split(':');
  if(algorithm!=='scrypt' || !/^[a-f0-9]{32}$/.test(salt||'') || !/^[a-f0-9]{128}$/.test(hex||''))return false;
  const expected=Buffer.from(hex,'hex'),actual=await derive(password,salt,64) as Buffer;
  return timingSafeEqual(expected,actual);
}
export function apiResult(work:()=>Promise<unknown>) {
  return work().then(data=>Response.json(data ?? null,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})).catch(error=> {
    const known=error instanceof ApiError;
    return Response.json({error:known?error.message:'서버에서 처리하지 못했어요'}, {status:known?error.status:503,headers:{'Cache-Control':'no-store',...(known&&error.status===429?{'Retry-After':'60'}:{})}});
  });
}

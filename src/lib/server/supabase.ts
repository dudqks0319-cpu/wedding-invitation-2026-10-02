import 'server-only';
import { cookies } from 'next/headers';
import { ApiError } from './validation';

export function backendConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.NEXT_PUBLIC_DATA_MODE !== 'remote' || !url || !key || !secret || !process.env.ABUSE_HASH_SECRET || process.env.ABUSE_HASH_SECRET.length < 32 || process.env.BACKEND_ENABLED !== 'true') throw new ApiError(503, '서버 연결이 준비되지 않았어요. 잠시 후 다시 이용해 주세요');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && !(process.env.ALLOW_LOCAL_SUPABASE === 'true' && ['localhost','127.0.0.1'].includes(parsed.hostname))) throw new ApiError(503,'서버 설정을 확인해 주세요');
  const site=process.env.NEXT_PUBLIC_SITE_URL && new URL(process.env.NEXT_PUBLIC_SITE_URL);
  if (!site || (site.protocol!=='https:' && !(process.env.ALLOW_LOCAL_SUPABASE==='true' && ['localhost','127.0.0.1'].includes(site.hostname)))) throw new ApiError(503,'사이트 주소 설정을 확인해 주세요');
  return { url: url.replace(/\/$/,''), key, secret };
}

export async function upstream<T>(path: string, init: RequestInit = {}, token?: string, privileged = false): Promise<T> {
  const c = backendConfig();
  const credential = privileged ? c.secret : c.key;
  const headers = new Headers(init.headers);
  headers.set('apikey', credential);
  // New publishable keys are not JWTs. A Bearer header is supplied only for a user token
  // or the server's legacy service_role JWT.
  if (token || (privileged && credential.startsWith('eyJ'))) headers.set('Authorization', `Bearer ${token ?? credential}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type','application/json');
  let response: Response;
  try { response = await fetch(`${c.url}${path}`, {...init,headers,cache:'no-store',signal:AbortSignal.timeout(8000)}); }
  catch { throw new ApiError(503,'서버 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요'); }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (err.code === '23505') throw new ApiError(409,'이미 사용 중인 주소예요');
    if (err.code === 'P0001') {
      if (err.message === 'quota_exceeded' || err.message === 'invitation_limit') throw new ApiError(429,'이용 한도에 도달했어요. 잠시 후 다시 이용해 주세요');
      if (err.message === 'idempotency_conflict' || err.message === 'write_in_progress') throw new ApiError(409,'같은 요청이 처리 중이거나 요청 내용이 바뀌었어요');
    }
    if (response.status === 401 || response.status === 403) throw new ApiError(401,'로그인이 필요해요');
    throw new ApiError(503,'서버에서 처리하지 못했어요. 잠시 후 다시 이용해 주세요');
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T;
  const body = await response.text();
  if (body.length > 2_000_000) throw new ApiError(503,'서버 응답이 너무 커요');
  return (body ? JSON.parse(body) : undefined) as T;
}

export function db<T>(table: string, filters: Record<string,string> = {}, method = 'GET', body?: unknown, token?: string) {
  return upstream<T>(`/rest/v1/${table}?${new URLSearchParams(filters)}`, {method,headers:{Prefer:'return=representation'},...(body === undefined ? {} : {body:JSON.stringify(body)})}, token, !token);
}
export function rpc<T>(name: string, body: unknown) {
  return upstream<T>(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(body)},undefined,true);
}
export interface SessionTokens {access_token: string; refresh_token: string; expires_in: number;}
export async function setTokens(tokens: SessionTokens) {
  if (!tokens.access_token || !tokens.refresh_token || !Number.isFinite(tokens.expires_in)) throw new ApiError(503,'로그인 응답을 확인할 수 없어요');
  const jar=await cookies();
  const options={httpOnly:true,secure:process.env.NODE_ENV==='production' && process.env.ALLOW_LOCAL_SUPABASE !== 'true',sameSite:'lax' as const,path:'/'};
  jar.set('bom-access',tokens.access_token,{...options,maxAge:Math.min(tokens.expires_in,3600)});
  jar.set('bom-refresh',tokens.refresh_token,{...options,maxAge:60*60*24*30});
}
export async function session(required=true): Promise<{id:string;token:string} | null> {
  backendConfig();
  const jar=await cookies(); let token=jar.get('bom-access')?.value;
  const refresh=jar.get('bom-refresh')?.value;
  for (let attempt=0;attempt<2;attempt++) {
    try {
      if (token) {
        const user=await upstream<{id:string;is_anonymous?:boolean}>('/auth/v1/user',{},token);
        if (/^[a-f0-9-]{36}$/.test(user.id) && !user.is_anonymous) return {id:user.id,token};
      }
    } catch(error) { if(error instanceof ApiError && error.status===503) throw error; }
    if (attempt===0 && refresh) {
      try { const tokens=await upstream<SessionTokens>('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:refresh})}); await setTokens(tokens); token=tokens.access_token; }
      catch (error) { if(error instanceof ApiError && error.status===503)throw error;break; }
    } else break;
  }
  for(const name of ['bom-access','bom-refresh'])jar.set(name,'',{path:'/',maxAge:0});
  if(required) throw new ApiError(401,'로그인이 필요해요');
  return null;
}

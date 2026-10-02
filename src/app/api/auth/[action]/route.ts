import {cookies} from 'next/headers';
import {randomBytes,createHash} from 'node:crypto';
import {backendConfig,session,setTokens,upstream,type SessionTokens} from '@/lib/server/supabase';
import {apiResult,checkOrigin,jsonBody,limits} from '@/lib/server/security';
import {ApiError,object,safeNext} from '@/lib/server/validation';

type Context={params:Promise<{action:string}>};
export function POST(request:Request,context:Context) {return apiResult(async()=>{
  checkOrigin(request);const {action}=await context.params;const jar=await cookies();
  await limits(request,'auth');
  if(action==='start') {
    const input=object(await jsonBody(request));
    if(input.provider!=='kakao' && input.provider!=='google')throw new ApiError(400,'지원하지 않는 로그인 방식이에요');
    const c=backendConfig(),verifier=randomBytes(48).toString('base64url'),state=randomBytes(24).toString('base64url');
    const next=safeNext(input.next),origin=new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin;
    const callback=new URL('/api/auth/callback',origin);callback.searchParams.set('flow',state);
    const options={httpOnly:true,secure:process.env.NODE_ENV==='production' && process.env.ALLOW_LOCAL_SUPABASE!=='true',sameSite:'lax' as const,path:'/api/auth',maxAge:600};
    jar.set('bom-pkce',verifier,options);jar.set('bom-flow',state,options);jar.set('bom-next',next,options);
    const url=new URL(`${c.url}/auth/v1/authorize`);
    url.searchParams.set('provider',input.provider);url.searchParams.set('redirect_to',callback.toString());
    url.searchParams.set('code_challenge',createHash('sha256').update(verifier).digest('base64url'));url.searchParams.set('code_challenge_method','s256');
    return {url:url.toString()};
  }
  if(action==='logout') {
    const user=await session(false);
    if(user)await upstream('/auth/v1/logout?scope=local',{method:'POST'},user.token);
    for(const name of ['bom-access','bom-refresh'])jar.set(name,'',{path:'/',maxAge:0});
    return {loggedOut:true};
  }
  throw new ApiError(404,'페이지를 찾을 수 없어요');
});}
export async function GET(request:Request,context:Context) {
  const {action}=await context.params;
  if(action==='session')return apiResult(async()=> {await limits(request,'auth-session');const user=await session(false);return {user:user?{id:user.id}:null};});
  if(action!=='callback')return Response.json({error:'페이지를 찾을 수 없어요'},{status:404});
  const jar=await cookies();const query=new URL(request.url).searchParams;
  const verifier=jar.get('bom-pkce')?.value,state=jar.get('bom-flow')?.value,next=safeNext(jar.get('bom-next')?.value);
  for(const name of ['bom-pkce','bom-flow','bom-next'])jar.set(name,'',{path:'/api/auth',maxAge:0});
  const origin=new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin;
  try {
    if(!verifier || !state || query.get('flow')!==state || !query.get('code') || query.get('error'))throw new ApiError(401,'로그인을 다시 시작해 주세요');
    await limits(request,'auth-callback');
    const tokens=await upstream<SessionTokens>('/auth/v1/token?grant_type=pkce',{method:'POST',body:JSON.stringify({auth_code:query.get('code'),code_verifier:verifier})});
    await setTokens(tokens);
    return new Response(null,{status:303,headers:{Location:new URL(next,origin).toString(),'Cache-Control':'no-store'}});
  } catch {
    return new Response(null,{status:303,headers:{Location:new URL('/login?error=oauth',origin).toString(),'Cache-Control':'no-store'}});
  }
}

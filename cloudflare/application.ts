import type {Env} from './types';
import {api,cleanup} from './service';
import {actor,publicQuota,quota} from './security';
import {safeNext,ApiError} from '../src/lib/server/validation';
import {getSampleBySlug} from '../src/data/samples';
import {WEDDING_ORIGIN,completeWeddingLogin} from './authBridge';
export {weddingBridgeRequest,weddingBridgeReturn} from './authBridge';
export const weddingOrigin=()=>WEDDING_ORIGIN;
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function replacementRequest(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname;
 if(env.NEXT_PUBLIC_SITE_URL===WEDDING_ORIGIN&&path==='/api/v2/auth/complete')return completeWeddingLogin(env,request);
 if(path.startsWith('/api/v2/'))return api(env,request);
 if(/^\/api\/photos\/[a-f0-9-]{36}$/.test(path))return api(env,new Request(new URL(path.replace('/api/photos/','/api/v2/photos/'),url),request));
 if(!['GET','HEAD'].includes(request.method))return null;
 if(!/^\/(?:|templates(?:\/[a-z0-9-]+)?|pricing|my|login|create\/[a-z0-9-]+|i\/[a-z0-9-]{3,30})$/.test(path))return null;
 if(!env.ASSETS)return new Response('화면 연결을 준비하고 있어요',{status:503});
 let title='청첩장 만들기',description='내 사진으로 만드는 모바일 청첩장',image='',status=200;
 if(path.startsWith('/i/')){
  const slug=path.slice(3),sample=getSampleBySlug(slug);
  if(sample){title=sample.shareTitle??title;description='AI 예시 사진을 사용한 디자인 미리보기';image=sample.coverPhoto;}
  else try{
   await quota(env,'global','api-total',10000,86400);await publicQuota(env,request);
   const row=await env.DB.prepare(`SELECT owner_id,public_data,public_expires_at FROM w2_invitations WHERE slug=?
    AND NOT EXISTS(SELECT 1 FROM deletion_jobs WHERE owner_id=w2_invitations.owner_id AND state<>'complete')`).bind(slug).first<{owner_id:string;public_data:string|null;public_expires_at:string}>();
   if(row?.public_data&&row.public_expires_at>new Date().toISOString()){
    const inv=JSON.parse(row.public_data);title=inv.shareTitle||title;description=inv.shareDescription||description;image=inv.coverPhoto;
   }else if(!row||row.owner_id!==(await actor(env,request,false))?.id)status=404;
  }catch(error){status=error instanceof ApiError?error.status:503;}
 }
 const asset=await env.ASSETS.fetch(new Request(new URL('/replacement/index.html',url),{method:'GET'}));
 if(!asset.ok)return new Response('화면 연결을 준비하고 있어요',{status:503});
 const origin=env.NEXT_PUBLIC_SITE_URL??url.origin;
 let html=await asset.text();
 html=html.replace(/<title>[^<]*<\/title>/,`<title>${escape(title)}</title>`);
 html=html.replace('</head>',`<meta name="robots" content="noindex,nofollow"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(origin+path)}">${image?`<meta property="og:image" content="${escape(new URL(image,origin).href)}">`:''}</head>`);
 return new Response(request.method==='HEAD'?null:html,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'SAMEORIGIN'}});
}
/** Called only after the existing OAuth callback has authenticated successfully. */
export function loginReturn(request:Request,response:Response){
 const url=new URL(request.url),location=response.headers.get('Location');
 if(!/^\/auth\/(kakao|google)\/callback$/.test(url.pathname)||!location)return response;
 const cookie=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-w2-return=([^;]+)/)?.[1];
 if(!cookie)return response;
 const redirect=new URL(location,url);
 // Native tickets and failed provider callbacks retain their original destination.
 if(redirect.pathname!=='/dashboard'||redirect.search!=='?import=1'||redirect.protocol!=='https:')return response;
 let next='/my';try{next=safeNext(decodeURIComponent(cookie));}catch{/* Safe fallback. */}
 const headers=new Headers(response.headers);headers.set('Location',new URL(next,redirect.origin).href);
 headers.append('Set-Cookie','__Host-w2-return=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
 return new Response(response.body,{status:response.status,headers});
}
export {cleanup};
const worker = {async fetch(request:Request,env:Env){return await replacementRequest(request,env)??new Response('Not found',{status:404});},async scheduled(_:unknown,env:Env){await cleanup(env);}};
export default worker;

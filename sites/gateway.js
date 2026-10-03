const origin='https://osamosam-api.dudqks0319.workers.dev';
const siteOrigin='https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site';
const gateway={
 async fetch(request,env){
  const secret=env.WEDDING_GATEWAY_SECRET,ip=request.headers.get('cf-connecting-ip');
  if(!secret||secret.length<32||!ip||!/^[a-fA-F0-9:.]{3,64}$/.test(ip))return new Response('사이트 연결을 준비하고 있어요.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
  const incoming=new URL(request.url),target=new URL(origin);target.pathname=incoming.pathname;target.search=incoming.search;
  const headers=new Headers(request.headers);
  for(const name of [...headers.keys()])if(name.startsWith('x-osam-')||name.startsWith('oai-authenticated-'))headers.delete(name);
  headers.delete('host');headers.set('x-forwarded-host',new URL(siteOrigin).host);headers.set('x-forwarded-proto','https');
  const timestamp=String(Date.now()),message=[request.method,target.pathname+target.search,ip,timestamp].join('\n');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  headers.set('x-osam-client-ip',ip);headers.set('x-osam-proxy-time',timestamp);
  headers.set('x-osam-proxy-signature',[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message)))].map(v=>v.toString(16).padStart(2,'0')).join(''));
  const init={method:request.method,headers,redirect:'manual',signal:AbortSignal.timeout(20000)};
  if(!['GET','HEAD'].includes(request.method)){init.body=request.body;init.duplex='half';}
  try{
   const upstream=await fetch(new Request(target,init)),out=new Headers(upstream.headers),location=out.get('Location');
   if(location){const redirect=new URL(location,origin);if(redirect.origin===origin){redirect.host=new URL(siteOrigin).host;out.set('Location',redirect.href);}}
   for(const name of [...out.keys()])if(name.startsWith('x-osam-'))out.delete(name);
   return new Response(upstream.body,{status:upstream.status,headers:out});
  }catch{return new Response('연결을 확인하고 다시 시도해 주세요.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});}
 }
};
export default gateway;

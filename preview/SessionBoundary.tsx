import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ClientError,request} from '@/lib/api';
import {createSessionWatcher} from '@/lib/sessionWatcher';
import {useLocation} from './router';

export function SessionBoundary({children}:{children:ReactNode}){
  const {pathname}=useLocation();
  const privateView=/^\/(my|create)(\/|$)/.test(pathname)||(/^\/i\//.test(pathname)&&!pathname.startsWith('/i/sample-'));
  const [checking,setChecking]=useState(true);
  const [failed,setFailed]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const watcherRef=useRef<ReturnType<typeof createSessionWatcher>|null>(null);
  useEffect(()=>{
    const watcher=watcherRef.current??createSessionWatcher({
      readIdentity:async()=>{
        try{const user=await request<{id:string}>('/api/auth/session');if(!user.id)throw new Error('Missing identity');return user.id;}
        catch(error){if(error instanceof ClientError&&error.status===401)return null;throw error;}
      },
      hide:()=>{setChecking(true);setFailed(false);},
      show:()=>setChecking(false),
      reload:()=>window.location.reload(),
      fail:()=>{setChecking(true);setFailed(true);},
    });
    watcherRef.current=watcher;
    const pause=()=>watcher.pause();
    const check=()=>{if(document.visibilityState==='visible')void watcher.check();};
    const visibility=()=>document.visibilityState==='hidden'?pause():check();
    window.addEventListener('blur',pause);
    window.addEventListener('focus',check);
    window.addEventListener('pageshow',check);
    document.addEventListener('visibilitychange',visibility);
    check();
    return()=>{watcher.dispose();window.removeEventListener('blur',pause);window.removeEventListener('focus',check);window.removeEventListener('pageshow',check);document.removeEventListener('visibilitychange',visibility);};
  },[attempt]);
  return <>
    <div hidden={privateView&&checking}>{children}</div>
    {privateView&&checking&&<div role="status" className="flex min-h-dvh items-center justify-center bg-cream p-8 text-center"><div><p>{failed?'연결을 확인하고 다시 시도해 주세요.':'로그인 상태를 확인하고 있어요…'}</p>{failed&&<button className="mt-4 min-h-11 rounded-full bg-ink px-6 text-white" onClick={()=>setAttempt(value=>value+1)}>다시 확인</button>}</div></div>}
  </>;
}

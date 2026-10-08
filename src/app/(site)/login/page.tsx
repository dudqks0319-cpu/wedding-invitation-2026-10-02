"use client";

import Link from "next/link";
import { Suspense,useState,useSyncExternalStore } from "react";
import { request } from "@/lib/api";
import { REMOTE_DATA } from "@/lib/dataMode";
import {useAuthSession} from '@/lib/authSession';
import {useSearchParams} from 'next/navigation';
import {useServiceConfig} from '@/lib/serviceConfig';

const subscribeNativeBridge=()=>()=>{};
const nativeBridgeAvailable=()=>{
  if(typeof window==='undefined')return false;
  const bridge=(window as Window & {webkit?:{messageHandlers?:{weddingAuth?:{supportsApple?:boolean}}}}).webkit?.messageHandlers?.weddingAuth;
  return !!bridge&&bridge.supportsApple!==false;
};
const noNativeBridge=()=>false;

function LoginForm() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nativeApple=useSyncExternalStore(subscribeNativeBridge,nativeBridgeAvailable,noNativeBridge);
  const {config}=useServiceConfig();
  const auth=useAuthSession();
  const params=useSearchParams();
  const expired=params.get('expired')==='1';
  const accountDeleted=params.get('accountDeleted')==='1';
  if(REMOTE_DATA&&auth==='signedIn')return <div className="flex min-h-[70vh] items-center justify-center px-5"><div className="text-center"><h1 className="text-[22px] font-bold">로그인되어 있어요</h1><Link href="/my" className="mt-6 inline-block rounded-full bg-brand-500 px-6 py-3 font-semibold text-white">내 청첩장으로 가기</Link></div></div>;
  const login = async (provider: 'kakao' | 'google' | 'apple') => {
    if (!REMOTE_DATA) return setMsg('로컬 미리보기예요. 로그인은 서버 연결 후 사용할 수 있어요.');
    const native=(window as Window & {webkit?:{messageHandlers?:{weddingAuth?:{postMessage:(provider:string)=>void}}}}).webkit?.messageHandlers?.weddingAuth;
    if(native){native.postMessage(provider);return;}
    setBusy(true);setMsg(null);
    try {
      const result=await request<{url:string}>('/api/auth/start','POST',{provider,next:new URLSearchParams(window.location.search).get('next') ?? '/my'});
      window.location.assign(result.url);
    } catch(error) {setMsg((error as Error).message);setBusy(false);}
  };
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm rounded-[32px] bg-white p-8 text-center shadow-[0_20px_60px_-24px_rgba(242,95,125,0.4)]">
        <p className="font-script text-[34px] text-brand-400">Welcome</p>
        <h1 className="mt-1 text-[22px] font-bold">로그인하고 시작하기</h1>
        <p className="mt-2 text-[14px] text-muted">로그인하면 어디서든 청첩장을 수정할 수 있어요</p>
        {accountDeleted&&<section role="status" className="mt-4 rounded-xl bg-brand-50 p-4 text-left text-[13px] leading-6"><h2 className="font-semibold">계정 삭제 요청을 처리했어요</h2><p>이 서비스의 공유 링크와 세션을 중지하고 청첩장·하객 응답·문의를 삭제했습니다. 사진 파일과 Apple 연결 해제는 정리 작업으로 이어서 처리합니다. 오삼오삼 자료는 유지됩니다.</p></section>}
        {expired&&<p role="alert" className="mt-4 text-[13px] text-brand-700">로그인을 완료하지 못했어요. 다시 시작해 주세요.</p>}
        <div className="mt-8 space-y-2.5">
          {nativeApple&&config.appleEnabled&&<button disabled={busy} onClick={()=>login('apple')} className="min-h-12 w-full rounded-xl bg-black px-4 py-3.5 text-[15px] font-semibold text-white">Apple로 로그인</button>}
          <button disabled={busy} onClick={() => login("kakao")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] py-3.5 text-[15px] font-semibold text-[#191919]">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7l-1 3.7c-.1.4.3.6.6.4l4.3-2.9c.5.1.9.1 1.4.1 5.5 0 10-3.6 10-8S17.5 3 12 3z" fill="#191919" />
            </svg>
            카카오로 시작하기
          </button>
          <button disabled={busy} onClick={() => login("google")} className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white py-3.5 text-[15px] font-semibold">
            <span className="text-[16px] font-black text-[#4285F4]">G</span>
            Google로 시작하기
          </button>
        </div>
        {msg && <p className="mt-5 rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">{msg}</p>}
        <p className="mt-8 text-[12px] text-muted">
          로그인 없이도 <Link href="/templates" className="text-brand-500 underline">바로 만들어 볼 수 있어요</Link>
        </p>
        <p className="mt-4 text-[12px] leading-6 text-muted">사용할 정보와 보관 기간은 <Link href="/privacy" className="underline">개인정보처리방침</Link>, 서비스 조건은 <Link href="/terms" className="underline">이용약관</Link>에서 확인할 수 있어요.</p>
      </div>
    </div>
  );
}

export default function LoginPage(){return <Suspense fallback={<p role="status" className="p-10 text-center">로그인 화면을 준비하고 있어요…</p>}><LoginForm /></Suspense>;}

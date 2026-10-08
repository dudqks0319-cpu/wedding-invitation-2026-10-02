"use client";
import Link from 'next/link';
import {useState,type FormEvent} from 'react';
import {request} from '@/lib/api';
import {useAuthSession} from '@/lib/authSession';
import {clearPrivateDrafts} from '@/lib/localStore';

export default function SettingsPage(){
 const auth=useAuthSession(),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function remove(e:FormEvent){
  e.preventDefault();if(busy||confirm!=='청첩장 계정 삭제')return;
  setBusy(true);setMessage('');
  try{await request('/api/account/deletion','DELETE',{confirm});clearPrivateDrafts();
   (window as Window & {webkit?:{messageHandlers?:{weddingAuth?:{postMessage:(value:string)=>void}}}}).webkit?.messageHandlers?.weddingAuth?.postMessage('accountDeleted');
   // Discard all in-memory API responses and pending requests with the old account.
   window.location.replace('/login?accountDeleted=1');}
  catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
 }
 return <div className="mx-auto max-w-xl px-5 py-14">
  <h1 className="text-3xl font-bold">계정 및 개인정보</h1>
  <div className="mt-6 flex flex-wrap gap-4 text-sm underline"><Link href="/privacy">개인정보처리방침</Link><Link href="/terms">이용약관</Link><Link href="/support">고객지원</Link></div>
  {auth==='checking'?<p role="status" className="mt-8">계정을 확인하고 있어요…</p>:auth!=='signedIn'?<p className="mt-8">{auth==='unavailable'?'계정 연결을 확인해 주세요.':'계정 삭제는 로그인 후 사용할 수 있어요.'} <Link className="underline" href="/login">로그인</Link></p>:
  <form onSubmit={remove} className="mt-8 rounded-2xl border border-red-100 bg-white p-6">
   <h2 className="text-xl font-bold">청첩장 서비스 계정 삭제</h2>
   <p className="mt-3 leading-7">이 서비스의 청첩장, 사진, 참석 명단, 방명록과 문의가 삭제되고 공유가 중지됩니다. 삭제한 자료는 복구할 수 없습니다. 기존 오삼오삼의 자료는 삭제하지 않습니다.</p>
   <p className="mt-3 text-sm text-muted">안전을 위해 최근 15분 안에 로그인한 계정만 삭제할 수 있어요.</p>
   <label htmlFor="delete-confirm" className="mt-5 block font-semibold">아래에 ‘청첩장 계정 삭제’를 입력해 주세요</label>
   <input id="delete-confirm" autoComplete="off" value={confirm} onChange={e=>setConfirm(e.target.value)} maxLength={30} className="mt-2 min-h-11 w-full rounded-xl border px-3 text-base" />
   {message&&<p role="alert" className="mt-3 text-red-700">{message}</p>}
   <button disabled={busy||confirm!=='청첩장 계정 삭제'} className="mt-5 min-h-11 rounded-xl bg-red-700 px-5 font-semibold text-white disabled:opacity-40">{busy?'삭제 중…':'자료와 서비스 계정 삭제'}</button>
  </form>}
 </div>;
}

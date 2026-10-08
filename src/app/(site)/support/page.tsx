"use client";
import Link from 'next/link';
import {useState,type FormEvent} from 'react';
import {request,refreshApi,useApiState} from '@/lib/api';
import {useAuthSession} from '@/lib/authSession';
import {useServiceConfig} from '@/lib/serviceConfig';
type Ticket={id:string;category:string;message:string;status:string;reply:string|null;createdAt:string};
const categories={login:'로그인',photo:'사진',sharing:'공유',privacy:'개인정보',other:'기타'};
export default function SupportPage(){
 const auth=useAuthSession(),{config}=useServiceConfig();
 const state=useApiState(auth==='signedIn'?'/api/account/support':''),tickets=(state.data as Ticket[]|undefined)??[];
 const [category,setCategory]=useState('other'),[message,setMessage]=useState(''),[result,setResult]=useState(''),[busy,setBusy]=useState(false);
 async function send(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setResult('');
  try{const ticket=await request<{id:string}>('/api/account/support','POST',{category,message});setResult('문의가 접수됐어요. 접수번호 '+ticket.id.slice(0,8));setMessage('');refreshApi('/api/account/support');}
  catch(error){setResult((error as Error).message);}finally{setBusy(false);}}
 return <div className="mx-auto max-w-xl px-5 py-14"><h1 className="text-3xl font-bold">고객지원</h1>
  <p className="mt-4 leading-7">로그인·사진 저장·공유·개인정보에 관한 문제를 알려주세요. 비밀번호, 전체 계좌번호나 다른 분의 개인정보는 넣지 마세요.</p>
  {config.supportEmail&&<a href={'mailto:'+config.supportEmail} className="mt-4 inline-block underline">이메일 문의: {config.supportEmail}</a>}
  {auth==='checking'?<p role="status" className="mt-8">로그인을 확인하고 있어요…</p>:auth!=='signedIn'?<p className="mt-8">앱 내 문의는 <Link href="/login" className="underline">로그인</Link> 후 사용할 수 있어요. 공개 청첩장의 신고는 로그인 없이 할 수 있습니다.</p>:
  <><form onSubmit={send} className="mt-8 space-y-4 rounded-2xl bg-white p-6">
   <label className="block">문의 유형<select value={category} onChange={e=>setCategory(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3 text-base">{Object.entries(categories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <label className="block">내용<textarea required minLength={1} maxLength={1000} value={message} onChange={e=>setMessage(e.target.value)} className="mt-2 min-h-32 w-full rounded-xl border p-3 text-base" /></label>
   <button disabled={busy||!message.trim()} className="min-h-11 rounded-xl bg-ink px-6 text-white disabled:opacity-40">{busy?'접수 중…':'문의 접수'}</button>
   {result&&<p role="status">{result}</p>}
  </form><h2 className="mt-10 text-xl font-bold">내 문의</h2>{state.loading?<p role="status">불러오는 중…</p>:state.error?<p role="alert">{state.error.message}</p>:tickets.length===0?<p className="mt-3 text-muted">접수한 문의가 없어요.</p>:tickets.map(ticket=><article key={ticket.id} className="mt-4 rounded-xl bg-white p-5"><p className="text-sm text-muted">{ticket.createdAt.slice(0,10)} · 접수번호 {ticket.id.slice(0,8)} · {ticket.status==='resolved'?'답변 완료':'접수됨'}</p><p className="mt-3 whitespace-pre-line">{ticket.message}</p>{ticket.reply&&<p className="mt-4 whitespace-pre-line rounded-xl bg-cream p-4">{ticket.reply}</p>}</article>)}</>}
  <div className="mt-8 flex gap-4 text-sm underline"><Link href="/privacy">개인정보처리방침</Link><Link href="/settings">계정 삭제</Link></div>
 </div>;
}

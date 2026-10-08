"use client";
import {useState,type FormEvent} from 'react';
import {request} from '@/lib/api';

export function ReportButton({slug,entryId,onReported}:{slug:string;entryId?:string;onReported?:()=>void}){
 const [reason,setReason]=useState('abuse'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState('');
 async function send(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setResult('');
  try{const data=await request<{id:string}>('/api/reports','POST',{slug,entryId,reason,message});setResult('신고가 접수됐어요. 접수번호 '+data.id.slice(0,8));onReported?.();}
  catch(error){setResult((error as Error).message);}finally{setBusy(false);}}
 return <details className="mt-3 text-left text-[13px] tracking-normal opacity-100"><summary className="flex min-h-11 cursor-pointer items-center underline">{entryId?'이 메시지 신고 · 내 화면에서 숨기기':'이 청첩장 신고'}</summary>
  <form onSubmit={send} className="space-y-3 rounded-xl border border-black/10 bg-white p-4 text-ink">
   <label className="block">신고 유형<select className="mt-1 min-h-11 w-full rounded-lg border px-2 text-base" value={reason} onChange={e=>setReason(e.target.value)}><option value="abuse">불쾌한 내용·괴롭힘</option><option value="privacy">개인정보 노출</option><option value="copyright">사진·저작권 침해</option><option value="other">기타</option></select></label>
   <label className="block">추가 설명 (선택)<textarea maxLength={500} value={message} onChange={e=>setMessage(e.target.value)} className="mt-1 min-h-24 w-full rounded-lg border p-2 text-base" /></label>
   <p>신고 내용은 운영자가 검토합니다. 비밀번호와 계좌번호는 넣지 마세요.</p>
   <button disabled={busy||result.startsWith('신고가 접수')} className="min-h-11 rounded-lg bg-ink px-4 text-white disabled:opacity-40">{busy?'접수 중…':'신고 접수'}</button>
   {result&&<p role="status">{result}</p>}
  </form>
 </details>;
}

"use client";
import Link from 'next/link';
import {useState,type FormEvent} from 'react';
import {request,refreshApi,useApiState} from '@/lib/api';
import {useAuthSession} from '@/lib/authSession';
type Ticket={id:string;category:string;message:string;status:string;reply:string|null;createdAt:string};
type Report={id:string;slug:string;entryId:string|null;reason:string;message:string;status:string;createdAt:string};
type Queue={support:Ticket[];reports:Report[]};
export default function OperationsPage(){
 const auth=useAuthSession(),state=useApiState(auth==='signedIn'?'/api/operator/queue':'');
 const queue=state.data as Queue|undefined;
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function act(action:string,body:unknown){if(busy)return;setBusy(true);setNotice('');
  try{await request('/api/operator/'+action,'POST',body);setNotice('처리 결과를 저장했어요.');refreshApi('/api/operator/queue');}
  catch(error){setNotice((error as Error).message);}finally{setBusy(false);}}
 function reply(e:FormEvent<HTMLFormElement>,id:string){e.preventDefault();const form=new FormData(e.currentTarget);void act('support',{id,reply:String(form.get('reply')??'')});}
 return <div className="mx-auto max-w-3xl px-5 py-12"><h1 className="text-3xl font-bold">문의·신고 처리</h1>
  <p className="mt-4 leading-7">권한이 등록된 운영자만 사용할 수 있습니다. 처리 전 해당 내용을 확인하고, 답변에 계좌번호·비밀번호 등 불필요한 개인정보를 넣지 마세요.</p>
  <p className="mt-3 text-sm text-muted">문의와 신고를 각각 최대 50개 표시합니다. 미처리 접수를 오래된 순서로 먼저 표시하고, 처리 후 다시 불러오면 다음 접수가 나타납니다.</p>
  {auth==='checking'||state.loading?<p role="status" className="mt-8">권한과 접수를 확인하고 있어요…</p>:auth!=='signedIn'?<Link href="/login" className="mt-8 inline-flex min-h-11 items-center underline">운영자 계정으로 로그인</Link>:state.error?<p role="alert" className="mt-8">{state.error.message}</p>:queue&&<>
   <h2 className="mt-10 text-xl font-bold">미처리 우선 문의</h2>
   {queue.support.length===0&&<p className="mt-3">접수된 문의가 없어요.</p>}
   {queue.support.map(ticket=><article key={ticket.id} className="mt-4 rounded-2xl border bg-white p-5">
    <p className="break-all text-sm text-muted">{ticket.createdAt.slice(0,10)} · {ticket.category} · {ticket.status} · {ticket.id}</p>
    <p className="mt-3 whitespace-pre-line break-words">{ticket.message}</p>
    <form onSubmit={e=>reply(e,ticket.id)} className="mt-4"><label className="block font-semibold">답변<textarea name="reply" required maxLength={1000} defaultValue={ticket.reply??''} className="mt-2 min-h-28 w-full rounded-xl border p-3 text-base" /></label>
     <button disabled={busy} className="mt-3 min-h-11 rounded-xl bg-ink px-5 text-white disabled:opacity-40">답변 저장</button>
    </form></article>)}
   <h2 className="mt-10 text-xl font-bold">미처리 우선 신고</h2>
   {queue.reports.length===0&&<p className="mt-3">접수된 신고가 없어요.</p>}
   {queue.reports.map(report=><article key={report.id} className="mt-4 rounded-2xl border bg-white p-5">
    <p className="break-all text-sm text-muted">{report.createdAt.slice(0,10)} · {report.reason} · {report.status} · {report.id}</p>
    <p className="mt-3 break-all">대상: {report.slug}{report.entryId&&' / 방명록 '+report.entryId}</p><p className="mt-3 whitespace-pre-line break-words">{report.message||'추가 설명 없음'}</p>
    <div className="mt-4 flex flex-wrap gap-2">
     {report.entryId&&<button disabled={busy} onClick={()=>{if(window.confirm('신고된 방명록 글을 삭제할까요?'))void act('reports',{id:report.id,decision:'hide-entry'});}} className="min-h-11 rounded-xl border px-4 disabled:opacity-40">방명록 글 삭제</button>}
     <button disabled={busy} onClick={()=>{if(window.confirm('이 청첩장의 공개를 중지하고 재공개를 제한할까요?'))void act('reports',{id:report.id,decision:'hold'});}} className="min-h-11 rounded-xl border px-4 text-red-700 disabled:opacity-40">청첩장 공개 제한</button>
     <button disabled={busy} onClick={()=>{if(window.confirm('공개 제한을 해제할까요? 작성자가 직접 다시 공개해야 합니다.'))void act('reports',{id:report.id,decision:'release'});}} className="min-h-11 rounded-xl border px-4 disabled:opacity-40">공개 제한 해제</button>
     <button disabled={busy} onClick={()=>void act('reports',{id:report.id,decision:'dismiss'})} className="min-h-11 rounded-xl border px-4 disabled:opacity-40">문제 없음</button>
    </div></article>)}
  </>}
  {notice&&<p role="status" className="mt-6 rounded-xl bg-white p-4">{notice}</p>}
 </div>;
}

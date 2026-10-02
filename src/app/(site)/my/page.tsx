"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteInvitation, publishInvitation, refreshApi, request, useApiState, useMyInvitations, useRsvpList } from "@/lib/api";
import {clearPrivateDrafts} from '@/lib/localStore';
import { REMOTE_DATA } from "@/lib/dataMode";
import { useHydrated } from "@/lib/useHydrated";
import { CATEGORY_SHORT, getTemplate } from "@/data/templates";
import { formatKoreanDate } from "@/lib/date";
import { getDisplay } from "@/lib/display";
import type { Invitation } from "@/types/invitation";

function GuestbookModeration({slug}:{slug:string}){
  const path=`/api/invitations/${slug}/moderation`,state=useApiState(path);
  const entries=(state.data as {id:string;name:string;message:string;approved:number}[]|undefined)??[];
  const [msg,setMsg]=useState('');
  if(!REMOTE_DATA)return null;
  return <details className="mt-3 rounded-2xl bg-cream p-4 text-[13px]"><summary>방명록 승인 · {entries.filter(e=>!e.approved).length}건 대기</summary>
    {(state.error||msg)&&<p role="alert">{msg||state.error?.message}</p>}
    {entries.map(e=><div key={e.id} className="mt-3 rounded-lg bg-white p-3"><b>{e.name}</b><p className="whitespace-pre-line">{e.message}</p><button className="mt-2 underline" onClick={async()=>{try {await request(path,'PATCH',{id:e.id,approved:!e.approved});refreshApi(path);refreshApi(`/api/invitations/${slug}/guestbook`);}catch(error){setMsg((error as Error).message);}}}>{e.approved?'숨기기':'승인하여 공개'}</button><button className="ml-4 underline" onClick={async()=>{if(!confirm('이 방명록을 삭제할까요?'))return;try{await request(path,'DELETE',{id:e.id});refreshApi(path);refreshApi(`/api/invitations/${slug}/guestbook`);}catch(error){setMsg((error as Error).message);}}}>삭제</button></div>)}
  </details>;
}

function RsvpSummary({ inv }: { inv: Invitation }) {
  const list = useRsvpList(inv.slug);
  const status = useApiState(`/api/invitations/${inv.slug}/rsvp`);
  const [open, setOpen] = useState(false);
  const yes = list.filter((r) => r.attending);
  const people = yes.reduce((s, r) => s + r.count, 0);
  return (
    <div className="mt-4 rounded-2xl bg-cream p-4">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-[13px]">
        <span>
          💌 참석 의사 <b>{list.length}</b>건 · 참석 예정 <b className="text-brand-600">{people}</b>명
        </span>
        <span className="text-muted">{open ? "접기" : "자세히"}</span>
      </button>
      {status.error && <p role="alert" className="mt-2 text-[13px]">{status.error.message}</p>}
      {open && (
        <ul className="mt-3 space-y-1.5 text-[13px]">
          {list.length === 0 && <li className="text-muted">아직 도착한 응답이 없어요</li>}
          {list.map((r) => (
            <li key={r.id} className="flex justify-between rounded-lg bg-white px-3 py-2">
              <span>
                {r.name} <span className="text-muted">({r.side === "groom" ? "신랑측" : r.side === "bride" ? "신부측" : "하객"})</span>
              </span>
              <span className={r.attending ? "text-brand-600" : "text-muted"}>{r.attending ? `참석 ${r.count}명` : "불참"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MyPage() {
  const hydrated = useHydrated();
  const all = useMyInvitations();
  const status=useApiState("/api/invitations");
  const [msg,setMsg]=useState<string | null>(null);
  const list = Object.values(all);

  return (
    <div className="mx-auto max-w-5xl px-5 pt-12">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-script text-[30px] text-brand-400">My Invitations</p>
          <h1 className="text-[28px] font-bold">내 청첩장</h1>
        </div>
        <Link href="/templates" className="rounded-full bg-brand-500 px-5 py-2.5 text-[14px] font-semibold text-white">
          ＋ 새로 만들기
        </Link>
      </div>
      <p className="mt-3 rounded-xl bg-butter px-4 py-3 text-[13px] text-ink/70">
        {REMOTE_DATA ? "초안은 나만 볼 수 있어요. 공유를 시작하면 링크로 하객을 초대할 수 있어요." : "이 브라우저에만 저장된 미리보기예요. 다른 기기로 공유하려면 서버 연결이 필요해요."}
      </p>

      {REMOTE_DATA && <div className="mt-4 flex gap-5 text-[13px]"><button onClick={async()=>{try {await request('/api/auth/logout','POST',{});clearPrivateDrafts();window.location.assign(new URL('/login',window.location.origin).href);} catch(error) {setMsg((error as Error).message);}}} className="underline">로그아웃</button>{process.env.NEXT_PUBLIC_BACKEND==='cloudflare'&&<a href="/dashboard" className="underline">이전에 만든 초대장 관리</a>}</div>}
      {status.loading && <p className="mt-5">불러오는 중…</p>}
      {(status.error || msg) && <p role="alert" className="mt-5">{msg ?? status.error?.message} {status.error?.status===401 && <Link href="/login?next=%2Fmy" className="underline">로그인하기</Link>}</p>}
      {hydrated && !status.loading && !status.error && list.length === 0 && (
        <div className="mt-10 rounded-[28px] border-2 border-dashed border-brand-200 bg-white py-20 text-center">
          <p className="text-[44px]">💌</p>
          <p className="mt-3 text-[17px] font-semibold">아직 만든 청첩장이 없어요</p>
          <Link href="/templates" className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-[14px] font-semibold text-white">
            디자인 고르러 가기
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {list.map((inv) => {
          const t = getTemplate(inv.templateId);
          const d = getDisplay(inv);
          return (
            <div key={inv.slug} className="rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_10px_30px_-16px_rgba(0,0,0,0.15)]">
              <div className="flex gap-4">
                <img src={inv.coverPhoto} alt="" className="h-28 w-22 shrink-0 rounded-2xl object-cover" style={{ width: 88 }} />
                <div className="min-w-0 flex-1">
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: t?.palette.accentSoft, color: t?.palette.accent }}>
                    {CATEGORY_SHORT[inv.type]} · {t?.name}
                  </span>
                  <p className="mt-2 truncate text-[17px] font-bold">{d.headline}</p>
                  <p className="text-[13px] text-muted">{formatKoreanDate(inv.dateTime)}</p>
                  <p className="truncate text-[12px] text-muted">/i/{inv.slug}</p>
                </div>
              </div>
              {REMOTE_DATA && <div className="mt-3 text-[13px]"><span>{inv.published ? '하객에게 공유 중' : '나만 보는 초안'}</span><button className="ml-3 underline" onClick={async()=>{if (!inv.published && !confirm('이름·연락처·계좌·사진이 링크를 가진 분에게 공개됩니다. 공유를 시작할까요?')) return;try {await publishInvitation(inv.slug,!inv.published,inv.revision);}catch(error){setMsg((error as Error).message);}}}>{inv.published ? '공유 중지' : '공유 시작'}</button></div>}
              <RsvpSummary inv={inv} />
              <GuestbookModeration slug={inv.slug} />
              <div className="mt-4 grid grid-cols-3 gap-2 text-[13px] font-medium">
                <Link href={`/i/${inv.slug}`} target="_blank" className="rounded-full bg-brand-500 py-2.5 text-center text-white">
                  보기
                </Link>
                <Link href={`/create/${inv.templateId}?edit=${inv.slug}`} className="rounded-full border border-black/10 py-2.5 text-center">
                  수정
                </Link>
                <button
                  onClick={async () => {
                    if (confirm("이 청첩장을 삭제할까요? 되돌릴 수 없어요.")) {try {await deleteInvitation(inv.slug);}catch(error){setMsg((error as Error).message);}}
                  }}
                  className="rounded-full border border-black/10 py-2.5 text-muted"
                >
                  삭제
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";

// TODO(backend): 카카오/네이버/구글 OAuth 로그인 연결 (docs/BACKEND_HANDOFF.md)
export default function LoginPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const soon = (name: string) => setMsg(`${name} 로그인은 백엔드 연결 후 사용할 수 있어요`);
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm rounded-[32px] bg-white p-8 text-center shadow-[0_20px_60px_-24px_rgba(242,95,125,0.4)]">
        <p className="font-script text-[34px] text-brand-400">Welcome</p>
        <h1 className="mt-1 text-[22px] font-bold">3초 만에 시작하기</h1>
        <p className="mt-2 text-[14px] text-muted">로그인하면 어디서든 청첩장을 수정할 수 있어요</p>
        <div className="mt-8 space-y-2.5">
          <button onClick={() => soon("카카오")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] py-3.5 text-[15px] font-semibold text-[#191919]">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7l-1 3.7c-.1.4.3.6.6.4l4.3-2.9c.5.1.9.1 1.4.1 5.5 0 10-3.6 10-8S17.5 3 12 3z" fill="#191919" />
            </svg>
            카카오로 시작하기
          </button>
          <button onClick={() => soon("네이버")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#03C75A] py-3.5 text-[15px] font-semibold text-white">
            <span className="text-[16px] font-black">N</span>
            네이버로 시작하기
          </button>
          <button onClick={() => soon("구글")} className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white py-3.5 text-[15px] font-semibold">
            <span className="text-[16px] font-black text-[#4285F4]">G</span>
            Google로 시작하기
          </button>
        </div>
        {msg && <p className="mt-5 rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">{msg}</p>}
        <p className="mt-8 text-[12px] text-muted">
          로그인 없이도 <Link href="/templates" className="text-brand-500 underline">바로 만들어 볼 수 있어요</Link>
        </p>
      </div>
    </div>
  );
}

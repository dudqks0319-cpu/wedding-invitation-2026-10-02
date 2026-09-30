"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";

const NAV = [
  { href: "/templates?type=wedding", label: "모바일 청첩장" },
  { href: "/templates?type=dol", label: "돌잔치" },
  { href: "/templates?type=party", label: "부모님 잔치" },
  { href: "/pricing", label: "요금 안내" },
  { href: "/my", label: "내 청첩장" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-brand-100/70 bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="hidden items-center gap-7 text-[15px] text-ink/80 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`transition hover:text-brand-500 ${pathname === n.href ? "font-semibold text-brand-500" : ""}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="rounded-full px-4 py-2 text-[14px] text-ink/70 transition hover:bg-brand-50">
            로그인
          </Link>
          <Link href="/templates" className="rounded-full bg-brand-500 px-5 py-2.5 text-[14px] font-semibold text-white shadow-[0_6px_16px_-4px_rgba(242,95,125,0.6)] transition hover:bg-brand-600">
            무료로 만들기
          </Link>
        </div>
        <button className="rounded-full p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="메뉴" aria-expanded={open}>
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" /> : <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" />}
          </svg>
        </button>
      </div>
      {open && (
        <div className="border-t border-brand-100 bg-cream px-5 pb-6 pt-2 md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block border-b border-brand-50 py-3.5 text-[15px]">
              {n.label}
            </Link>
          ))}
          <div className="mt-4 flex gap-2">
            <Link href="/login" onClick={() => setOpen(false)} className="flex-1 rounded-full border border-brand-200 py-3 text-center text-[14px]">
              로그인
            </Link>
            <Link href="/templates" onClick={() => setOpen(false)} className="flex-1 rounded-full bg-brand-500 py-3 text-center text-[14px] font-semibold text-white">
              무료로 만들기
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

import Link from "next/link";
import { SITE } from "@/lib/site";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-brand-100 bg-white/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 text-[14px] leading-7 text-muted">
            {SITE.tagline}
            <br />
            모바일 청첩장 · 돌잔치 · 부모님 잔치 초대장
          </p>
        </div>
        {[
          { title: "만들기", links: [["모바일 청첩장", "/templates?type=wedding"], ["돌잔치 초대장", "/templates?type=dol"], ["부모님 잔치", "/templates?type=party"]] },
          { title: "서비스", links: [["요금 안내", "/pricing"], ["내 청첩장", "/my"], ["로그인", "/login"]] },
          { title: "고객센터", links: [["자주 묻는 질문", "/#faq"], ["1:1 문의 (준비 중)", "#"], ["이용약관 (준비 중)", "#"]] },
        ].map((col) => (
          <div key={col.title}>
            <p className="text-[14px] font-semibold">{col.title}</p>
            <ul className="mt-4 space-y-2.5 text-[14px] text-muted">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="hover:text-brand-500">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="border-t border-brand-50 py-6 text-center text-[12px] text-muted">
        © {new Date().getFullYear()} {SITE.nameEn}. 디자인 시안 (프론트엔드 미리보기)
      </p>
    </footer>
  );
}

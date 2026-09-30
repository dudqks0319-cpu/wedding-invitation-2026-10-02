import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "요금 안내" };

const PLANS = [
  {
    name: "무료",
    price: "0원",
    desc: "필요한 기능은 모두 담았어요",
    color: "bg-white",
    cta: "무료로 시작하기",
    features: ["모든 디자인 사용", "지도 · 계좌 · 방명록 · 참석 의사", "사진 최대 10장", "카카오톡 공유", "하단 로고 표시"],
  },
  {
    name: "프리미엄",
    price: "19,900원",
    desc: "가장 많이 선택하는 플랜",
    color: "bg-gradient-to-br from-brand-400 to-[#FFA08A] text-white",
    best: true,
    cta: "프리미엄으로 만들기",
    features: ["무료 기능 전체", "사진 최대 30장", "배경음악 업로드", "하단 로고 제거", "참석자 명단 엑셀 다운로드", "보관 기간 1년"],
  },
  {
    name: "프리미엄 + 감사장",
    price: "29,900원",
    desc: "예식 후 감사 인사까지",
    color: "bg-white",
    cta: "선택하기",
    features: ["프리미엄 기능 전체", "모바일 감사장 1종", "원하는 주소(URL) 지정", "우선 고객 지원"],
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-14">
      <div className="text-center">
        <p className="font-script text-[32px] text-brand-400">Pricing</p>
        <h1 className="mt-1 text-[32px] font-bold">부담 없이, 필요한 만큼만</h1>
        <p className="mt-3 text-[15px] text-muted">결제는 백엔드 연결 후 제공될 예정이에요 (현재는 디자인 시안)</p>
      </div>
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.name} className={`relative flex flex-col rounded-[28px] border border-black/5 p-8 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.2)] ${p.color}`}>
            {p.best && <span className="absolute -top-3 left-8 rounded-full bg-ink px-3 py-1 text-[12px] font-bold text-white">BEST</span>}
            <p className="text-[17px] font-semibold">{p.name}</p>
            <p className={`mt-1 text-[13px] ${p.best ? "text-white/80" : "text-muted"}`}>{p.desc}</p>
            <p className="mt-6 text-[36px] font-bold">{p.price}</p>
            <ul className="mt-6 flex-1 space-y-3 text-[14px]">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className={p.best ? "text-white" : "text-brand-500"}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/templates" className={`mt-8 rounded-full py-3.5 text-center text-[15px] font-semibold ${p.best ? "bg-white text-brand-600" : "bg-ink text-white"}`}>
              {p.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";
import { CATEGORY_LABEL, TEMPLATES, getTemplate } from "@/data/templates";
import { createSample } from "@/data/samples";
import { InvitationView } from "@/components/invitation/InvitationView";
import { PhoneFrame } from "@/components/site/PhoneFrame";
import { TemplateCard } from "@/components/site/TemplateCard";

const INCLUDED = ["표지 & 인사말", "달력 & D-day", "사진 갤러리", "오시는 길 (지도)", "마음 전하실 곳", "참석 의사 전달", "축하 방명록", "카카오톡 공유"];

export function TemplateDetailView({ id }: { id: string }) {
  const theme = getTemplate(id);
  if (!theme) return <p className="py-32 text-center text-muted">디자인을 찾을 수 없어요</p>;
  const sample = createSample(theme);
  const similar = TEMPLATES.filter((t) => t.category === theme.category && t.id !== theme.id).slice(0, 4);
  const p = theme.palette;

  return (
    <div className="mx-auto max-w-6xl px-5 pt-8">
      <nav className="text-[13px] text-muted">
        <Link href="/templates" className="hover:text-brand-500">디자인</Link>
        <span className="mx-2">›</span>
        <Link href={`/templates?type=${theme.category}`} className="hover:text-brand-500">{CATEGORY_LABEL[theme.category]}</Link>
        <span className="mx-2">›</span>
        <span className="text-ink">{theme.name}</span>
      </nav>

      <div className="mt-8 grid items-start gap-12 md:grid-cols-[minmax(0,420px)_1fr]">
        <div className="relative md:sticky md:top-24">
          <div className="absolute inset-0 -z-10 m-auto h-3/4 w-3/4 rounded-full blur-3xl" style={{ background: p.accentSoft }} />
          <PhoneFrame className="max-w-[360px]">
            <InvitationView invitation={sample} theme={theme} mode="frame" readOnly />
          </PhoneFrame>
          <p className="mt-4 text-center text-[13px] text-muted">↑ 휴대폰 화면 안을 스크롤해 보세요</p>
        </div>

        <div className="md:pt-6">
          <div className="flex gap-1.5">
            {theme.isBest && <span className="rounded-full bg-brand-500 px-2.5 py-1 text-[11px] font-bold text-white">BEST</span>}
            {theme.isNew && <span className="rounded-full bg-[#4FB39B] px-2.5 py-1 text-[11px] font-bold text-white">NEW</span>}
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-muted">{CATEGORY_LABEL[theme.category]}</span>
          </div>
          <p className="mt-5 text-[28px] leading-none" style={{ fontFamily: theme.fonts.script, color: p.accent }}>
            {theme.nameEn}
          </p>
          <h1 className="mt-2 text-[34px] font-bold">{theme.name}</h1>
          <p className="mt-3 text-[16px] leading-7 text-muted">{theme.description}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {theme.tags.map((t) => (
              <span key={t} className="rounded-full bg-white px-3 py-1 text-[13px] text-ink/60">#{t}</span>
            ))}
          </div>

          <div className="mt-8 grid gap-4 rounded-3xl bg-white p-6 sm:grid-cols-2">
            <div>
              <p className="text-[13px] font-semibold text-muted">컬러 팔레트</p>
              <div className="mt-3 flex gap-2">
                {[p.bg, p.accentSoft, p.accent, p.text].map((c) => (
                  <span key={c} className="h-9 w-9 rounded-full border border-black/5 shadow-inner" style={{ background: c }} title={c} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-muted">글꼴</p>
              <p className="mt-3 text-[20px]" style={{ fontFamily: theme.fonts.title }}>가나다 사랑해</p>
              <p className="text-[18px]" style={{ fontFamily: theme.fonts.script, color: p.accent }}>Love & Wedding</p>
            </div>
          </div>

          <div className="mt-4 rounded-3xl bg-white p-6">
            <p className="text-[13px] font-semibold text-muted">포함된 구성</p>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-[14px]">
              {INCLUDED.map((i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white" style={{ background: p.accent }}>✓</span>
                  {i}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={`/create/${theme.id}`} className="flex-1 rounded-full bg-brand-500 py-4 text-center text-[16px] font-semibold text-white shadow-[0_10px_24px_-8px_rgba(242,95,125,0.7)] transition hover:bg-brand-600">
              이 디자인으로 만들기
            </Link>
            <Link href={`/i/sample-${theme.id}`} target="_blank" className="flex-1 rounded-full border border-ink/10 bg-white py-4 text-center text-[16px] font-semibold transition hover:border-brand-300">
              새 창에서 크게 보기 ↗
            </Link>
          </div>
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-24">
          <h2 className="text-[22px] font-bold">비슷한 디자인</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
            {similar.map((t) => (
              <TemplateCard key={t.id} theme={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

import Link from "next/link";
import { TEMPLATES, getTemplate } from "@/data/templates";
import { createSample } from "@/data/samples";
import { photo } from "@/data/photos";
import { InvitationView } from "@/components/invitation/InvitationView";
import { PhoneFrame } from "@/components/site/PhoneFrame";
import { TemplateCard } from "@/components/site/TemplateCard";
import { SITE } from "@/lib/site";

const FEATURES = [
  { icon: "🗺️", title: "카카오맵 · 네이버지도", desc: "예식장 위치를 지도로 보여주고, 길찾기 앱으로 바로 연결해요.", bg: "bg-mint" },
  { icon: "💳", title: "계좌번호 & 카카오페이", desc: "신랑측·신부측 계좌를 나눠 담고 버튼 한 번에 복사돼요.", bg: "bg-butter" },
  { icon: "💌", title: "참석 의사 (RSVP)", desc: "참석 인원과 식사 여부를 미리 받아 식장 예약이 쉬워져요.", bg: "bg-brand-50" },
  { icon: "📝", title: "축하 방명록", desc: "하객들이 남긴 따뜻한 메시지를 한곳에 모아 간직하세요.", bg: "bg-lilac" },
  { icon: "🖼️", title: "사진 갤러리", desc: "웨딩 스냅을 넘겨보는 갤러리와 확대 보기를 지원해요.", bg: "bg-sky" },
  { icon: "💬", title: "카카오톡 공유", desc: "대표 사진과 문구가 담긴 예쁜 카드로 단톡방에 공유해요.", bg: "bg-peach" },
];

const STEPS = [
  { n: "01", title: "디자인 고르기", desc: "청첩장, 돌잔치, 부모님 잔치까지 19가지 디자인 중 마음에 드는 것을 골라요." },
  { n: "02", title: "내용 채우기", desc: "이름, 날짜, 예식장, 사진만 넣으면 오른쪽 미리보기에 바로 반영돼요." },
  { n: "03", title: "링크로 공유하기", desc: "완성된 청첩장을 카카오톡과 문자로 보내세요. 수정은 언제든 무제한!" },
];

const FAQ = [
  ["정말 무료로 만들 수 있나요?", "기본 디자인과 모든 필수 기능(지도, 계좌, 방명록, 참석 의사)은 무료예요. 광고 제거·사진 무제한 같은 프리미엄 옵션만 유료로 준비 중입니다."],
  ["청첩장을 보낸 뒤에도 수정할 수 있나요?", "네! 같은 링크 그대로 내용이 바로 바뀌어요. 예식장 정보나 오타도 걱정 없어요."],
  ["돌잔치나 칠순 잔치도 만들 수 있나요?", "돌잔치 전용 디자인 4종, 부모님 잔치(회갑·칠순·팔순) 디자인 2종이 준비되어 있어요."],
  ["청첩장은 언제까지 볼 수 있나요?", "행사일로부터 6개월 동안 유지되고, 원하시면 기간을 연장할 수 있어요."],
];

export default function Home() {
  const hero1 = getTemplate("blossom")!;
  const hero2 = getTemplate("dol-balloon")!;
  const best = TEMPLATES.filter((t) => t.isBest || t.isNew).slice(0, 8);
  const counts = {
    wedding: TEMPLATES.filter((t) => t.category === "wedding").length,
    dol: TEMPLATES.filter((t) => t.category === "dol").length,
    party: TEMPLATES.filter((t) => t.category === "party").length,
  };

  return (
    <>
      {/* ───────── 히어로 ───────── */}
      <section className="relative overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-100 blur-3xl" />
        <div className="absolute -right-32 top-20 h-[420px] w-[420px] rounded-full bg-butter blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full bg-mint blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 md:grid-cols-[1.1fr_1fr] md:pt-20">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-4 py-1.5 text-[13px] font-medium text-brand-600">
              🌸 2027 봄 신상 디자인 오픈
            </span>
            <h1 className="mt-6 font-serif text-[40px] font-bold leading-[1.3] tracking-tight text-ink md:text-[54px]">
              가장 설레는 소식을,
              <br />
              <span className="relative inline-block">
                <span className="relative z-10">가장 예쁘게</span>
                <span className="absolute bottom-1 left-0 z-0 h-4 w-full rounded-full bg-brand-200/70" />
              </span>{" "}
              전하세요
            </h1>
            <p className="mt-6 max-w-md text-[17px] leading-8 text-muted">
              모바일 청첩장부터 돌잔치, 부모님 잔치 초대장까지.{" "}
              <br className="hidden md:block" />
              지도 · 계좌번호 · 방명록 · 참석 여부를 한 번에 담아 5분 만에 완성해요.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/templates" className="rounded-full bg-brand-500 px-7 py-4 text-[16px] font-semibold text-white shadow-[0_10px_24px_-8px_rgba(242,95,125,0.7)] transition hover:-translate-y-0.5 hover:bg-brand-600">
                무료로 청첩장 만들기
              </Link>
              <Link href="#designs" className="rounded-full border border-ink/10 bg-white px-7 py-4 text-[16px] font-semibold text-ink transition hover:border-brand-300">
                디자인 구경하기
              </Link>
            </div>
            <dl className="mt-10 flex gap-8">
              {[
                [`${TEMPLATES.length}종`, "디자인"],
                ["5분", "완성"],
                ["무제한", "수정"],
              ].map(([v, k]) => (
                <div key={k}>
                  <dt className="text-[24px] font-bold text-ink">{v}</dt>
                  <dd className="text-[13px] text-muted">{k}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto h-[520px] w-[340px] max-w-full md:h-[600px] md:w-[460px]">
            <div className="absolute left-0 top-0 w-[62%] animate-float">
              <PhoneFrame>
                <InvitationView invitation={createSample(hero1)} theme={hero1} mode="frame" readOnly />
              </PhoneFrame>
            </div>
            <div className="absolute bottom-0 right-0 w-[55%] animate-float [animation-delay:1.5s]">
              <PhoneFrame>
                <InvitationView invitation={createSample(hero2)} theme={hero2} mode="frame" readOnly />
              </PhoneFrame>
            </div>
            <div className="absolute left-0 bottom-24 rounded-2xl bg-white px-4 py-3 text-[13px] shadow-xl md:-left-10">
              <p className="font-semibold">💌 참석 의사 12건 도착</p>
              <p className="text-muted">신랑측 7 · 신부측 5</p>
            </div>
            <div className="absolute right-0 top-16 rounded-2xl bg-white px-4 py-3 text-[13px] shadow-xl md:-right-8">
              <p className="font-semibold">🗺️ 지도 연결 완료</p>
              <p className="text-muted">카카오맵 · 네이버지도</p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── 카테고리 ───────── */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { type: "wedding", title: "모바일 청첩장", desc: "두 사람의 새로운 시작", img: photo("wedding-blossom"), bg: "from-brand-100 to-peach", count: counts.wedding },
            { type: "dol", title: "돌잔치 초대장", desc: "우리 아기 첫 번째 생일", img: photo("dol-balloon"), bg: "from-butter to-[#FFF1DC]", count: counts.dol },
            { type: "party", title: "부모님 잔치", desc: "회갑 · 칠순 · 팔순 잔치", img: photo("party-mother"), bg: "from-mint to-sky", count: counts.party },
          ].map((c) => (
            <Link key={c.type} href={`/templates?type=${c.type}`} className={`group relative flex h-44 overflow-hidden rounded-3xl bg-gradient-to-br ${c.bg} p-7 transition hover:-translate-y-1`}>
              <div className="relative z-10">
                <p className="text-[13px] text-ink/60">{c.desc}</p>
                <p className="mt-1 text-[22px] font-bold text-ink">{c.title}</p>
                <p className="mt-5 inline-flex items-center gap-1 text-[14px] font-semibold text-ink/80">
                  디자인 {c.count}종 보기 <span className="transition group-hover:translate-x-1">→</span>
                </p>
              </div>
              <img src={c.img} alt="" className="absolute -bottom-6 -right-4 h-48 w-36 rotate-6 rounded-2xl object-cover shadow-lg transition group-hover:rotate-3" />
            </Link>
          ))}
        </div>
      </section>

      {/* ───────── 인기 디자인 ───────── */}
      <section id="designs" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-script text-[30px] text-brand-400">Best Designs</p>
            <h2 className="mt-1 text-[28px] font-bold">지금 가장 사랑받는 디자인</h2>
          </div>
          <Link href="/templates" className="hidden rounded-full border border-ink/10 bg-white px-5 py-2.5 text-[14px] font-medium hover:border-brand-300 md:block">
            전체 디자인 보기 →
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
          {best.map((t) => (
            <TemplateCard key={t.id} theme={t} />
          ))}
        </div>
        <div className="mt-10 text-center md:hidden">
          <Link href="/templates" className="inline-block rounded-full border border-ink/10 bg-white px-6 py-3 text-[14px] font-medium">
            전체 디자인 보기 →
          </Link>
        </div>
      </section>

      {/* ───────── 기능 ───────── */}
      <section className="bg-white/70 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center">
            <p className="font-script text-[30px] text-brand-400">All in one</p>
            <h2 className="mt-1 text-[28px] font-bold">필요한 기능은 전부, 무료로</h2>
            <p className="mt-3 text-[16px] text-muted">하객도, 우리도 편한 청첩장을 만들어요</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-3xl border border-black/5 bg-white p-7 transition hover:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.15)]">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-[24px] ${f.bg}`}>{f.icon}</span>
                <p className="mt-5 text-[17px] font-semibold">{f.title}</p>
                <p className="mt-2 text-[14px] leading-6 text-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── 만드는 방법 ───────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="text-center">
          <p className="font-script text-[30px] text-brand-400">How it works</p>
          <h2 className="mt-1 text-[28px] font-bold">딱 3단계면 완성돼요</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative rounded-3xl bg-gradient-to-br from-white to-brand-50 p-8">
              <span className="text-[40px] font-bold text-brand-200">{s.n}</span>
              <p className="mt-2 text-[19px] font-semibold">{s.title}</p>
              <p className="mt-2 text-[14px] leading-6 text-muted">{s.desc}</p>
              {i < 2 && <span className="absolute -right-5 top-1/2 hidden -translate-y-1/2 text-[24px] text-brand-300 md:block">→</span>}
            </div>
          ))}
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-16">
        <h2 className="text-center text-[28px] font-bold">자주 묻는 질문</h2>
        <div className="mt-10 space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-2xl border border-black/5 bg-white px-6 py-5 open:shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[16px] font-medium">
                <span>
                  <span className="mr-2 text-brand-500">Q.</span>
                  {q}
                </span>
                <span className="text-muted transition group-open:rotate-45">＋</span>
              </summary>
              <p className="mt-3 text-[14px] leading-7 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="mx-auto max-w-6xl px-5 pt-10">
        <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-r from-brand-400 via-brand-300 to-[#FFB38A] px-8 py-14 text-center text-white md:py-20">
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/20" />
          <div className="absolute -bottom-16 right-10 h-56 w-56 rounded-full bg-white/15" />
          <p className="relative font-script text-[36px]">{SITE.nameEn}</p>
          <h2 className="relative mt-2 text-[28px] font-bold md:text-[34px]">지금 바로 우리만의 청첩장을 만들어 보세요</h2>
          <Link href="/templates" className="relative mt-8 inline-block rounded-full bg-white px-8 py-4 text-[16px] font-bold text-brand-600 shadow-lg transition hover:-translate-y-0.5">
            무료로 시작하기
          </Link>
        </div>
      </section>
    </>
  );
}

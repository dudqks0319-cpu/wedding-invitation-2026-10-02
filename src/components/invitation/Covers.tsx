"use client";

import type { CSSProperties, ReactNode } from "react";
import type { CoverVariant } from "@/types/invitation";
import { formatDotDate, formatEnglishDate, formatKoreanDate, formatKoreanTime } from "@/lib/date";
import { Photo, useInv } from "./shared";
import { BalloonIcon, CloudIcon, HeartIcon, KnotIcon, LeafIcon, PetalIcon, SparkleIcon, StarIcon } from "./Ornaments";

/**
 * 청첩장 첫 화면(표지) 디자인 모음.
 * 템플릿마다 cover 값에 따라 아래 중 하나가 그려집니다.
 */

function Shell({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <header
      className={`relative flex flex-col items-center justify-center overflow-hidden text-center ${className}`}
      style={{ minHeight: "var(--cover-h)", ...style }}
    >
      {children}
    </header>
  );
}

function useCoverText() {
  const { inv, d } = useInv();
  const en = formatEnglishDate(inv.dateTime);
  return {
    d,
    inv,
    en,
    dot: formatDotDate(inv.dateTime),
    koDate: formatKoreanDate(inv.dateTime),
    koTime: formatKoreanTime(inv.dateTime),
    venue: [inv.venue.name, inv.venue.hall].filter(Boolean).join(" "),
    /** 이름 줄: 신랑 & 신부 / 아기 / 주인공 */
    nameLine: d.shortNames.join(d.joiner ? ` ${d.joiner} ` : ""),
  };
}

function ScrollHint() {
  return (
    <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 opacity-60">
      <span className="text-[10px] tracking-[0.3em]" style={{ fontFamily: "var(--font-sans)" }}>
        SCROLL
      </span>
      <svg width="14" height="14" viewBox="0 0 24 24" className="animate-bounce" aria-hidden>
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    </div>
  );
}

/* 1. 벚꽃 연서 – 아치형 사진 */
function ArchCover() {
  const { inv, d, dot, koDate, koTime, venue, nameLine } = useCoverText();
  return (
    <Shell className="px-8 pb-16 pt-12">
      <p className="inv-script text-[30px]" style={{ color: "var(--inv-accent)" }}>
        {d.scriptLine}
      </p>
      <div className="relative mt-6 w-[76%]">
        <div
          className="absolute -inset-2.5 rounded-t-full border"
          style={{ borderColor: "var(--inv-accent)", opacity: 0.45 }}
        />
        <Photo src={inv.coverPhoto} className="relative aspect-[3/4] w-full rounded-t-full" />
        <PetalIcon size={34} color="var(--inv-accent)" className="absolute -left-5 top-10 opacity-80" />
        <PetalIcon size={24} color="var(--inv-accent)" className="absolute -right-3 top-28 opacity-60" />
        <PetalIcon size={18} color="var(--inv-accent)" className="absolute -bottom-2 right-8 opacity-70" />
      </div>
      <p className="mt-9 text-[12px] tracking-[0.4em]" style={{ color: "var(--inv-subtext)" }}>
        {dot}
      </p>
      <h1 className="inv-title mt-3 text-[28px] font-bold tracking-wide">{nameLine}</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--inv-subtext)" }}>
        {koDate} {koTime}
        <br />
        {venue}
      </p>
    </Shell>
  );
}

/* 2. 아이보리 클래식 – 금박 이중 테두리 */
function LetterCover() {
  const { inv, d, en, koDate, koTime, venue } = useCoverText();
  return (
    <Shell className="p-5">
      <div className="relative flex w-full flex-1 flex-col items-center justify-center border px-6 py-12" style={{ borderColor: "var(--inv-accent)" }}>
        <div className="pointer-events-none absolute inset-1.5 border" style={{ borderColor: "var(--inv-line)" }} />
        {["left-2 top-2", "right-2 top-2 rotate-90", "right-2 bottom-2 rotate-180", "left-2 bottom-2 -rotate-90"].map((pos) => (
          <svg key={pos} className={`absolute ${pos}`} width="26" height="26" viewBox="0 0 26 26" aria-hidden>
            <path d="M2 24 V8 Q2 2 8 2 H24" fill="none" stroke="var(--inv-accent)" strokeWidth="1.2" />
            <circle cx="8" cy="8" r="2" fill="var(--inv-accent)" />
          </svg>
        ))}
        <p className="text-[11px] tracking-[0.45em]" style={{ color: "var(--inv-accent)", fontFamily: "var(--inv-script)" }}>
          THE {d.eventEn} OF
        </p>
        <h1 className="inv-title mt-7 space-y-1 text-[27px] font-bold leading-snug">
          {d.names.map((n, i) => (
            <span key={n + i} className="block">
              {i > 0 && d.joiner && (
                <span className="inv-script my-1 block text-[26px] font-normal italic" style={{ color: "var(--inv-accent)" }}>
                  and
                </span>
              )}
              {n}
            </span>
          ))}
        </h1>
        <Photo src={inv.coverPhoto} className="mt-8 aspect-[4/5] w-[72%] border-4" style={{ borderColor: "var(--inv-surface)" }} />
        <div className="mt-8 flex items-center gap-3" style={{ color: "var(--inv-accent)" }}>
          <span className="h-px w-8" style={{ background: "currentColor" }} />
          <span className="text-[12px] tracking-[0.3em]" style={{ fontFamily: "var(--inv-script)" }}>
            {en.month} {en.day}, {en.year}
          </span>
          <span className="h-px w-8" style={{ background: "currentColor" }} />
        </div>
        <p className="mt-4 text-[14px] leading-7" style={{ color: "var(--inv-subtext)" }}>
          {koDate} {koTime}
          <br />
          {venue}
        </p>
      </div>
    </Shell>
  );
}

/* 3. 그린 가든 – 잎사귀 프레임 */
function BotanicalCover() {
  const { inv, d, dot, koDate, koTime, venue, nameLine } = useCoverText();
  return (
    <Shell className="px-7 pb-14 pt-12">
      <p className="inv-script text-[34px] italic" style={{ color: "var(--inv-accent)" }}>
        {d.scriptLine}
      </p>
      <p className="mt-1 text-[11px] tracking-[0.5em]" style={{ color: "var(--inv-subtext)" }}>
        {dot}
      </p>
      <div className="relative mt-8 w-[84%]">
        <Photo src={inv.coverPhoto} className="aspect-[4/5] w-full rounded-[28px]" />
        <div className="absolute -left-8 -top-7 -rotate-[35deg]">
          <LeafIcon size={44} color="var(--inv-accent)" />
        </div>
        <div className="absolute -right-4 -top-4 rotate-[40deg] opacity-80">
          <LeafIcon size={28} color="var(--inv-accent)" />
        </div>
        <div className="absolute -bottom-6 -right-8 rotate-[150deg]">
          <LeafIcon size={46} color="var(--inv-accent)" />
        </div>
        <div className="absolute -bottom-3 -left-5 rotate-[200deg] opacity-70">
          <LeafIcon size={26} color="var(--inv-accent)" />
        </div>
      </div>
      <h1 className="inv-title mt-10 text-[26px] font-bold tracking-[0.12em]">{nameLine}</h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--inv-subtext)" }}>
        {koDate} {koTime} · {venue}
      </p>
    </Shell>
  );
}

/* 4. 레몬 폴라로이드 – 마스킹테이프 */
function PolaroidCover() {
  const { inv, d, koDate, koTime, venue, nameLine } = useCoverText();
  return (
    <Shell
      className="px-8 pb-16 pt-10"
      style={{
        backgroundImage: "radial-gradient(var(--inv-line) 1.4px, transparent 1.6px)",
        backgroundSize: "18px 18px",
      }}
    >
      <p className="inv-title text-[40px] leading-tight" style={{ color: "var(--inv-accent)" }}>
        {inv.type === "wedding" ? "우리 결혼해요!" : d.headline}
      </p>
      <div className="relative mt-7 w-[80%] -rotate-3 bg-white p-3 pb-14 shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
        <span className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 rotate-2" style={{ background: "var(--inv-accent)", opacity: 0.55 }} />
        <Photo src={inv.coverPhoto} className="aspect-square w-full" />
        <p className="inv-title absolute bottom-3 left-0 right-0 text-[26px]" style={{ color: "var(--inv-text)" }}>
          {nameLine} <HeartIcon size={18} color="var(--inv-accent)" className="inline -mt-1" />
        </p>
      </div>
      <HeartIcon size={26} color="var(--inv-accent)" className="absolute right-10 top-28 rotate-12 opacity-70" />
      <HeartIcon size={16} color="var(--inv-accent)" className="absolute left-10 top-44 -rotate-12 opacity-60" />
      <p className="inv-title mt-10 text-[24px]">{koDate}</p>
      <p className="text-[15px]" style={{ color: "var(--inv-subtext)" }}>
        {koTime} · {venue}
      </p>
    </Shell>
  );
}

/* 5. 하늘 편지 – 편지봉투 */
function EnvelopeCover() {
  const { inv, d, dot, koDate, koTime, venue, nameLine } = useCoverText();
  return (
    <Shell className="px-8 pb-16 pt-12" style={{ background: "linear-gradient(180deg, var(--inv-accent-soft), var(--inv-bg) 70%)" }}>
      <CloudIcon size={34} color="#fff" className="absolute left-6 top-16" />
      <CloudIcon size={24} color="#fff" className="absolute right-8 top-32 opacity-90" />
      <CloudIcon size={28} color="#fff" className="absolute bottom-40 left-3 opacity-80" />
      <p className="text-[12px] tracking-[0.35em]" style={{ color: "var(--inv-accent)" }}>
        TO. MY DEAREST
      </p>
      <p className="inv-script mt-2 text-[34px]" style={{ color: "var(--inv-text)" }}>
        {d.scriptLine}
      </p>
      <div className="relative mt-8 w-[84%]">
        {/* 편지지 */}
        <div className="relative z-10 mx-auto w-[86%] bg-white p-2.5 shadow-md" style={{ animation: "rise 5s ease-in-out infinite" }}>
          <Photo src={inv.coverPhoto} className="aspect-[4/5] w-full" />
        </div>
        {/* 봉투 */}
        <div className="relative z-20 -mt-24 h-36 w-full overflow-hidden rounded-b-lg" style={{ background: "var(--inv-accent)" }}>
          <div className="absolute inset-x-0 top-0 h-full" style={{ background: "linear-gradient(160deg, transparent 49.5%, rgba(255,255,255,.18) 50%)" }} />
          <div className="absolute inset-x-0 top-0 h-full" style={{ background: "linear-gradient(200deg, transparent 49.5%, rgba(255,255,255,.12) 50%)" }} />
          <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow">
            <HeartIcon size={20} color="var(--inv-accent)" />
          </div>
        </div>
      </div>
      <h1 className="inv-title mt-10 text-[26px] font-bold">{nameLine}</h1>
      <p className="mt-1 text-[12px] tracking-[0.4em]" style={{ color: "var(--inv-accent)" }}>
        {dot}
      </p>
      <p className="mt-2 text-[14px]" style={{ color: "var(--inv-subtext)" }}>
        {koDate} {koTime}
        <br />
        {venue}
      </p>
    </Shell>
  );
}

/* 6. 피치 필름 – 필름 스트립 + 날짜 스탬프 */
function FilmCover() {
  const { inv, d, en, koDate, koTime, venue, nameLine } = useCoverText();
  const holes = Array.from({ length: 9 });
  return (
    <Shell className="px-6 pb-16 pt-12">
      <p className="text-[11px] tracking-[0.5em]" style={{ color: "var(--inv-accent)" }}>
        OUR LITTLE MOMENTS
      </p>
      <h1 className="inv-title mt-3 text-[30px] font-bold">{nameLine}</h1>
      <div className="relative mt-7 w-[88%] rotate-[-1.5deg] rounded-md bg-[#3E302A] px-3 py-7 shadow-xl">
        {["top-2", "bottom-2"].map((pos) => (
          <div key={pos} className={`absolute inset-x-3 ${pos} flex justify-between`}>
            {holes.map((_, i) => (
              <span key={i} className="h-2.5 w-3.5 rounded-[2px] bg-[#FFF6F0]" />
            ))}
          </div>
        ))}
        <div className="relative">
          <Photo src={inv.coverPhoto} className="aspect-[4/5] w-full" />
          <span
            className="absolute bottom-3 right-3 text-[18px] font-bold tracking-widest"
            style={{ color: "#FF9A3C", fontFamily: "'Courier New', monospace", textShadow: "0 0 6px rgba(255,140,40,.7)" }}
          >
            {`'${String(en.year).slice(2)} ${String(inv.dateTime.slice(5, 7))} ${String(en.day).padStart(2, "0")}`}
          </span>
        </div>
      </div>
      <p className="inv-script mt-9 text-[26px] italic" style={{ color: "var(--inv-accent)" }}>
        {d.scriptLine}
      </p>
      <p className="mt-2 text-[14px]" style={{ color: "var(--inv-subtext)" }}>
        {koDate} {koTime}
        <br />
        {venue}
      </p>
    </Shell>
  );
}

/* 7. 라벤더 드림 – 원형 프레임 */
function CircleCover() {
  const { inv, d, dot, koDate, koTime, venue, nameLine } = useCoverText();
  return (
    <Shell className="px-8 pb-16 pt-10">
      <div className="absolute -left-20 top-10 h-64 w-64 rounded-full blur-3xl" style={{ background: "var(--inv-accent-soft)" }} />
      <div className="absolute -right-24 bottom-24 h-72 w-72 rounded-full blur-3xl" style={{ background: "#FCE4EE" }} />
      <p className="inv-script relative text-[40px]" style={{ color: "var(--inv-accent)" }}>
        {d.englishNames.join(" & ")}
      </p>
      <div className="relative mt-6 w-[74%]">
        <div
          className="absolute -inset-4 rounded-full border-2 border-dashed"
          style={{ borderColor: "var(--inv-accent)", opacity: 0.4, animation: "spin-slow 40s linear infinite" }}
        />
        <Photo src={inv.coverPhoto} className="aspect-square w-full rounded-full shadow-[0_20px_50px_rgba(164,139,209,0.35)]" />
        <SparkleIcon size={26} color="var(--inv-accent)" className="absolute -right-2 top-4" />
        <SparkleIcon size={16} color="var(--inv-accent)" className="absolute -left-3 bottom-10 opacity-70" />
        <SparkleIcon size={12} color="#F5B7CF" className="absolute right-6 -bottom-3" />
      </div>
      <h1 className="inv-title relative mt-12 text-[26px] font-bold tracking-[0.1em]">{nameLine}</h1>
      <p className="relative mt-1 text-[12px] tracking-[0.4em]" style={{ color: "var(--inv-accent)" }}>
        {dot}
      </p>
      <p className="relative mt-2 text-[14px]" style={{ color: "var(--inv-subtext)" }}>
        {koDate} {koTime} · {venue}
      </p>
    </Shell>
  );
}

/* 8. 모던 매거진 – 큰 타이포 */
function MagazineCover() {
  const { inv, d, en, koDate, koTime, venue, nameLine } = useCoverText();
  return (
    <Shell className="justify-start">
      <Photo src={inv.coverPhoto} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 35%, rgba(255,255,255,0) 60%, rgba(255,255,255,.92) 100%)" }} />
      <div className="relative w-full px-6 pr-16 pt-8 text-left">
        <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.2em]">
          <span>VOL. 01</span>
          <span>{en.month} {en.year}</span>
        </div>
        <p className="mt-2 text-[58px] font-bold leading-[0.9] tracking-tight" style={{ fontFamily: "var(--inv-script)" }}>
          {inv.type === "wedding" ? "WEDDING" : inv.type === "dol" ? "BIRTHDAY" : "CELEBRATE"}
        </p>
        <span className="mt-3 inline-block px-2 py-1 text-[11px] font-bold tracking-widest text-white" style={{ background: "var(--inv-accent)" }}>
          SPECIAL ISSUE
        </span>
      </div>
      <div className="relative mt-auto w-full px-6 pb-14 text-left">
        <p className="text-[13px] font-semibold" style={{ color: "var(--inv-accent)" }}>
          {d.eventKo}
        </p>
        <h1 className="mt-1 text-[34px] font-extrabold leading-tight tracking-tight">{nameLine}</h1>
        <div className="mt-4 h-px w-full bg-black/20" />
        <div className="mt-3 flex justify-between text-[12px] font-medium">
          <span>{koDate}</span>
          <span>{koTime}</span>
        </div>
        <p className="mt-1 text-[12px] opacity-70">{venue}</p>
      </div>
    </Shell>
  );
}

/* 9. 코랄 선셋 – 화면 가득 사진 */
function FullPhotoCover() {
  const { inv, d, dot, koDate, koTime, venue, nameLine } = useCoverText();
  return (
    <Shell className="justify-end">
      <Photo src={inv.coverPhoto} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,247,243,0) 30%, rgba(255,247,243,0.85) 62%, var(--inv-bg) 80%)" }} />
      <div className="relative px-8 pb-16">
        <p className="inv-script text-[40px] leading-none" style={{ color: "var(--inv-accent)" }}>
          {d.scriptLine}
        </p>
        <h1 className="inv-title mt-5 text-[26px] font-bold tracking-[0.15em]">{nameLine}</h1>
        <p className="mt-2 text-[12px] tracking-[0.4em]" style={{ color: "var(--inv-subtext)" }}>
          {dot}
        </p>
        <p className="mt-1 text-[14px]" style={{ color: "var(--inv-subtext)" }}>
          {koDate} {koTime} · {venue}
        </p>
      </div>
    </Shell>
  );
}

/* 10. 한옥의 봄 – 한지 + 세로쓰기 */
function HanjiCover() {
  const { inv, d, koDate, koTime, venue } = useCoverText();
  const title = inv.type === "wedding" ? "혼인합니다" : inv.type === "dol" ? "첫돌잔치" : `${inv.party?.eventName ?? ""}잔치`;
  return (
    <Shell className="px-7 pb-14 pt-12">
      <div className="absolute inset-4 border" style={{ borderColor: "var(--inv-line)" }} />
      <div className="relative flex w-full items-start justify-center gap-5">
        <div className="relative w-[70%]">
          <div className="rounded-t-[48%] border-[6px] p-1.5" style={{ borderColor: "#8B6F58" }}>
            <Photo src={inv.coverPhoto} className="aspect-[3/4] w-full rounded-t-[46%]" />
          </div>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
            <KnotIcon size={26} />
          </div>
        </div>
        <h1
          className="inv-title text-[34px] tracking-[0.35em]"
          style={{ writingMode: "vertical-rl", color: "var(--inv-accent)" }}
        >
          {title}
        </h1>
      </div>
      <p className="inv-title mt-12 text-[22px] tracking-[0.2em]">
        {inv.type === "wedding" && inv.wedding ? (
          <>
            <span className="text-[13px] opacity-60">신랑 </span>
            {inv.wedding.groom.name}
            <span className="mx-2" style={{ color: "var(--inv-accent)" }}>·</span>
            <span className="text-[13px] opacity-60">신부 </span>
            {inv.wedding.bride.name}
          </>
        ) : (
          d.names.join(" · ")
        )}
      </p>
      <p className="mt-3 text-[14px] leading-7" style={{ color: "var(--inv-subtext)" }}>
        {koDate} {koTime}
        <br />
        {venue}
      </p>
    </Shell>
  );
}

/* 11. 미니멀 라인 – 반반 분할 */
function SplitCover() {
  const { inv, d, en, koDate, koTime, venue } = useCoverText();
  const mm = inv.dateTime.slice(5, 7);
  const dd = String(en.day).padStart(2, "0");
  return (
    <Shell className="justify-start">
      <Photo src={inv.coverPhoto} className="h-[46%] min-h-[260px] w-full" />
      <div className="flex w-full flex-1 flex-col items-center justify-center px-8 pb-16 pt-8">
        <div className="flex items-center gap-4 text-[44px] font-extralight leading-none tracking-tight">
          <span>{mm}</span>
          <span className="h-10 w-px rotate-[25deg]" style={{ background: "var(--inv-text)" }} />
          <span>{dd}</span>
        </div>
        <p className="mt-3 text-[10px] tracking-[0.5em]" style={{ color: "var(--inv-subtext)" }}>
          {en.weekday}
        </p>
        <div className="my-5 h-px w-10" style={{ background: "var(--inv-line)" }} />
        <h1 className="text-[20px] font-medium tracking-[0.3em]">
          {d.names.join(d.joiner ? "  |  " : " ")}
        </h1>
        <p className="mt-3 text-[13px] font-light leading-6" style={{ color: "var(--inv-subtext)" }}>
          {koDate} {koTime}
          <br />
          {venue}
        </p>
      </div>
    </Shell>
  );
}

/* 12. 수채화 부케 – 번지는 물감 */
function WatercolorCover() {
  const { inv, d, dot, koDate, koTime, venue, nameLine } = useCoverText();
  const blob = (color: string, cls: string) => (
    <div className={`absolute rounded-full blur-2xl ${cls}`} style={{ background: color, opacity: 0.55 }} />
  );
  return (
    <Shell className="px-8 pb-16 pt-12">
      {blob("#BFE8DA", "-left-16 -top-10 h-64 w-64")}
      {blob("#F9C9D6", "-right-16 top-40 h-56 w-56")}
      {blob("#FDE3C8", "left-4 bottom-24 h-40 w-48")}
      {blob("#C9E4F5", "-right-10 -bottom-10 h-48 w-48")}
      <p className="inv-script relative text-[44px] leading-none" style={{ color: "var(--inv-accent)" }}>
        {d.englishNames.join(" & ")}
      </p>
      <div className="relative mt-7 w-[82%]">
        <Photo
          src={inv.coverPhoto}
          className="aspect-[4/5] w-full"
          style={{
            WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)",
            maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)",
          }}
        />
      </div>
      <h1 className="inv-title relative mt-4 text-[26px] font-bold tracking-[0.12em]">{nameLine}</h1>
      <p className="relative mt-1 text-[12px] tracking-[0.4em]" style={{ color: "var(--inv-subtext)" }}>
        {dot}
      </p>
      <p className="relative mt-2 text-[14px]" style={{ color: "var(--inv-subtext)" }}>
        {koDate} {koTime}
        <br />
        {venue}
      </p>
    </Shell>
  );
}

/* 13. 민트 피크닉 – 깅엄 체크 */
function GinghamCover() {
  const { inv, d, koDate, koTime, venue, nameLine } = useCoverText();
  return (
    <Shell
      className="px-7 pb-14 pt-10"
      style={{
        backgroundColor: "var(--inv-bg)",
        backgroundImage:
          "linear-gradient(90deg, rgba(79,179,155,.13) 50%, transparent 50%), linear-gradient(rgba(79,179,155,.13) 50%, transparent 50%)",
        backgroundSize: "36px 36px",
      }}
    >
      <div className="relative w-full rounded-[32px] bg-white/95 px-6 pb-9 pt-8 shadow-[0_10px_40px_rgba(79,179,155,0.18)]">
        <p className="inv-title text-[34px] leading-tight" style={{ color: "var(--inv-accent)" }}>
          {inv.type === "wedding" ? "소풍 같은 결혼식에 초대해요" : d.headline}
        </p>
        <div className="relative mx-auto mt-5 w-[88%]">
          <Photo src={inv.coverPhoto} className="aspect-[4/3] w-full rounded-2xl" />
          <span className="absolute -right-3 -top-3 flex h-12 w-12 rotate-12 items-center justify-center rounded-full text-white shadow" style={{ background: "var(--inv-accent)" }}>
            <HeartIcon size={20} color="#fff" />
          </span>
          <span className="absolute -bottom-3 -left-2 rounded-full bg-[#FFE27A] px-3 py-1 text-[12px] font-bold text-[#6B5A12] shadow -rotate-6">
            SAVE THE DATE
          </span>
        </div>
        <h1 className="inv-title mt-8 text-[32px]">{nameLine}</h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--inv-subtext)" }}>
          {koDate} {koTime}
          <br />
          {venue}
        </p>
      </div>
    </Shell>
  );
}

/* 14. 파스텔 풍선 (돌잔치) */
function BalloonCover() {
  const { inv, d, dot, koDate, koTime, venue } = useCoverText();
  const balloons = [
    { c: "#F9B4C4", x: "8%", y: "12%", s: 34, dl: "0s" },
    { c: "#FFD98A", x: "80%", y: "8%", s: 40, dl: "1s" },
    { c: "#A8D8E8", x: "86%", y: "44%", s: 28, dl: "2s" },
    { c: "#C8B6EE", x: "4%", y: "50%", s: 30, dl: "1.5s" },
    { c: "#B9E2C4", x: "18%", y: "30%", s: 22, dl: "0.5s" },
  ];
  return (
    <Shell className="px-8 pb-16 pt-12" style={{ background: "linear-gradient(180deg, #FFEFF3, var(--inv-bg))" }}>
      {balloons.map((b, i) => (
        <div key={i} className="absolute" style={{ left: b.x, top: b.y, animation: `rise 4s ease-in-out ${b.dl} infinite` }}>
          <BalloonIcon size={b.s} color={b.c} />
        </div>
      ))}
      <p className="text-[18px] font-semibold tracking-wide" style={{ fontFamily: "var(--inv-script)", color: "var(--inv-accent)" }}>
        {d.scriptLine}
      </p>
      <div className="relative mt-6 w-[70%]">
        <div className="absolute -inset-3 rounded-full" style={{ background: "repeating-conic-gradient(var(--inv-accent-soft) 0 10deg, #fff 10deg 20deg)" }} />
        <Photo src={inv.coverPhoto} className="relative aspect-square w-full rounded-full border-[6px] border-white" />
        <span className="absolute -bottom-2 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-white text-[30px] shadow-md" style={{ fontFamily: "var(--inv-title)", color: "var(--inv-accent)" }}>
          1
        </span>
      </div>
      <h1 className="inv-title mt-10 text-[32px]">{d.headline}</h1>
      <p className="mt-1 text-[13px] tracking-[0.3em]" style={{ color: "var(--inv-accent)" }}>
        {dot}
      </p>
      <p className="mt-2 text-[14px]" style={{ color: "var(--inv-subtext)" }}>
        {koDate} {koTime}
        <br />
        {venue}
      </p>
    </Shell>
  );
}

/* 15. 곰돌이 첫돌 (돌잔치) */
function BearCover() {
  const { inv, d, koDate, koTime, venue } = useCoverText();
  return (
    <Shell className="px-8 pb-16 pt-14">
      <p className="text-[15px] font-semibold tracking-[0.2em]" style={{ fontFamily: "var(--inv-script)", color: "var(--inv-accent)" }}>
        {d.englishNames[0]}&apos;s First Birthday
      </p>
      <div className="relative mt-12 w-[72%]">
        {/* 곰 귀 */}
        <span className="absolute -left-2 -top-7 h-20 w-20 rounded-full" style={{ background: "var(--inv-accent)" }}>
          <span className="absolute inset-4 rounded-full" style={{ background: "var(--inv-accent-soft)" }} />
        </span>
        <span className="absolute -right-2 -top-7 h-20 w-20 rounded-full" style={{ background: "var(--inv-accent)" }}>
          <span className="absolute inset-4 rounded-full" style={{ background: "var(--inv-accent-soft)" }} />
        </span>
        <div className="relative rounded-full p-2.5" style={{ background: "var(--inv-accent)" }}>
          <Photo src={inv.coverPhoto} className="aspect-square w-full rounded-full" />
        </div>
        <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-1 text-[13px] shadow" style={{ color: "var(--inv-accent)", fontFamily: "var(--inv-title)" }}>
          첫 생일 축하해
        </span>
      </div>
      <h1 className="inv-title mt-10 text-[30px]">우리 {d.shortNames[0]} 돌잔치</h1>
      <div className="mt-2 flex items-center gap-2" style={{ color: "var(--inv-accent)" }}>
        <HeartIcon size={12} color="currentColor" />
        <HeartIcon size={12} color="currentColor" />
        <HeartIcon size={12} color="currentColor" />
      </div>
      <p className="mt-3 text-[14px]" style={{ color: "var(--inv-subtext)" }}>
        {koDate} {koTime}
        <br />
        {venue}
      </p>
    </Shell>
  );
}

const SAEKDONG = ["#E0685C", "#F4C54E", "#6DB38A", "#5B86C9", "#F2A7C0", "#FFFFFF", "#9C7FC9"];

function SaekdongBand() {
  return (
    <div className="flex h-5 w-full">
      {Array.from({ length: 21 }).map((_, i) => (
        <span key={i} className="flex-1" style={{ background: SAEKDONG[i % SAEKDONG.length] }} />
      ))}
    </div>
  );
}

/* 16. 색동 돌잔치 */
function SaekdongCover() {
  const { inv, d, koDate, koTime, venue } = useCoverText();
  return (
    <Shell className="justify-between">
      <SaekdongBand />
      <div className="flex flex-col items-center px-8 py-8">
        <p className="text-[12px] tracking-[0.5em]" style={{ color: "var(--inv-subtext)" }}>
          初度 · 첫 생일
        </p>
        <h1 className="inv-title mt-3 text-[46px] leading-none" style={{ color: "var(--inv-accent)" }}>
          첫돌잔치
        </h1>
        <div className="relative mt-7 w-[74%]">
          <Photo src={inv.coverPhoto} className="aspect-[4/5] w-full rounded-[40px] border-4" style={{ borderColor: "#F4C54E" }} />
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white px-2 py-1 shadow">
            <KnotIcon size={20} />
          </div>
        </div>
        <p className="inv-title mt-9 text-[26px]">{d.names[0]}</p>
        <p className="mt-2 text-[14px]" style={{ color: "var(--inv-subtext)" }}>
          {koDate} {koTime}
          <br />
          {venue}
        </p>
      </div>
      <SaekdongBand />
    </Shell>
  );
}

/* 17. 별빛 아가 (돌잔치) */
function StarryCover() {
  const { inv, d, dot, koDate, koTime, venue } = useCoverText();
  const stars = [
    ["10%", "12%", 14], ["84%", "10%", 18], ["70%", "26%", 10], ["16%", "40%", 12],
    ["88%", "52%", 14], ["6%", "68%", 10], ["78%", "74%", 12], ["30%", "8%", 9],
  ] as const;
  return (
    <Shell className="px-8 pb-16 pt-12" style={{ background: "linear-gradient(180deg, #DCE6FB 0%, var(--inv-bg) 75%)" }}>
      {stars.map(([x, y, s], i) => (
        <div key={i} className="absolute" style={{ left: x, top: y, animation: `twinkle ${2 + (i % 3)}s ease-in-out ${i * 0.3}s infinite` }}>
          <StarIcon size={s} color={i % 2 ? "#FFE08A" : "#fff"} />
        </div>
      ))}
      <p className="text-[15px] font-semibold tracking-[0.2em]" style={{ fontFamily: "var(--inv-script)", color: "var(--inv-accent)" }}>
        TWINKLE TWINKLE
      </p>
      <h1 className="inv-title mt-2 text-[28px]">반짝반짝 {d.shortNames[0]}의 첫 생일</h1>
      <div className="relative mt-8 w-[72%]">
        <Photo src={inv.coverPhoto} className="aspect-square w-full rounded-full border-[8px] border-white shadow-[0_14px_40px_rgba(126,155,224,0.35)]" />
        <svg className="absolute -right-6 -top-4" width="70" height="70" viewBox="0 0 70 70" aria-hidden>
          <path d="M40 6 a28 28 0 1 0 24 42 a22 22 0 1 1 -24 -42z" fill="#FFE08A" />
        </svg>
      </div>
      <p className="mt-9 text-[13px] tracking-[0.4em]" style={{ color: "var(--inv-accent)" }}>
        {dot}
      </p>
      <p className="mt-2 text-[14px]" style={{ color: "var(--inv-subtext)" }}>
        {koDate} {koTime}
        <br />
        {venue}
      </p>
    </Shell>
  );
}

function Peony({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((r) => (
        <ellipse key={r} cx="50" cy="24" rx="16" ry="24" fill="#F2A9B1" transform={`rotate(${r} 50 50)`} />
      ))}
      {[22, 67, 112, 157, 202, 247, 292, 337].map((r) => (
        <ellipse key={r} cx="50" cy="32" rx="11" ry="17" fill="#E88A96" transform={`rotate(${r} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="12" fill="#D0666E" />
      <circle cx="50" cy="50" r="5" fill="#F9D56E" />
    </svg>
  );
}

/* 18. 모란 칠순연 (부모님 잔치) */
function PeonyCover() {
  const { inv, d, koDate, koTime, venue } = useCoverText();
  const eventName = inv.party?.eventName ?? "잔치";
  return (
    <Shell className="px-8 pb-16 pt-14">
      <Peony size={120} className="absolute -left-10 -top-8 opacity-90" />
      <Peony size={90} className="absolute -right-6 top-24 opacity-80" />
      <Peony size={110} className="absolute -bottom-6 -right-10 opacity-90" />
      <LeafIcon size={30} color="#A7C08F" className="absolute bottom-20 left-2 rotate-[-20deg]" />
      <p className="text-[12px] tracking-[0.5em]" style={{ color: "var(--inv-subtext)" }}>
        壽宴 · 축하연
      </p>
      <h1 className="inv-title mt-3 text-[48px] leading-none" style={{ color: "var(--inv-accent)" }}>
        {eventName}연
      </h1>
      <div className="relative mt-8 w-[70%] border p-2" style={{ borderColor: "var(--inv-accent)" }}>
        <Photo src={inv.coverPhoto} className="aspect-[4/5] w-full" />
      </div>
      <p className="inv-title mt-8 text-[24px]">
        {d.names[0]} <span className="text-[15px] opacity-70">님</span>
      </p>
      <p className="mt-2 text-[14px] leading-7" style={{ color: "var(--inv-subtext)" }}>
        {koDate} {koTime}
        <br />
        {venue}
      </p>
    </Shell>
  );
}

/* 19. 해돋이 회갑연 (부모님 잔치) */
function SunriseCover() {
  const { inv, d, dot, koDate, koTime, venue } = useCoverText();
  const eventName = inv.party?.eventName ?? "잔치";
  return (
    <Shell className="px-8 pb-16 pt-14" style={{ background: "linear-gradient(180deg, #FFF3D6 0%, var(--inv-bg) 60%)" }}>
      <p className="inv-script text-[26px] italic" style={{ color: "var(--inv-accent)" }}>
        {d.scriptLine}
      </p>
      <div className="relative mt-8 w-[80%]">
        <div className="absolute -inset-x-6 -top-8 aspect-square rounded-full" style={{ background: "radial-gradient(circle, #FFE3A3 0%, #FFD27A 40%, transparent 70%)" }} />
        <div className="absolute -inset-x-2 top-4 flex justify-center" aria-hidden>
          <svg viewBox="0 0 200 100" className="w-full opacity-50">
            {Array.from({ length: 11 }).map((_, i) => {
              const a = Math.PI * (i / 10);
              return <line key={i} x1={100} y1={100} x2={100 - Math.cos(a) * 100} y2={100 - Math.sin(a) * 100} stroke="#F2B544" strokeWidth="1.2" />;
            })}
          </svg>
        </div>
        <Photo src={inv.coverPhoto} className="relative mx-auto aspect-[3/4] w-[82%] rounded-t-full border-[6px] border-white shadow-lg" />
      </div>
      <h1 className="inv-title mt-9 text-[34px] font-bold" style={{ color: "var(--inv-text)" }}>
        {d.names[0]}님의 {eventName}
      </h1>
      <p className="mt-1 text-[13px] tracking-[0.4em]" style={{ color: "var(--inv-accent)" }}>
        {dot}
      </p>
      <p className="mt-2 text-[14px]" style={{ color: "var(--inv-subtext)" }}>
        {koDate} {koTime}
        <br />
        {venue}
      </p>
    </Shell>
  );
}

const COVERS: Record<CoverVariant, () => ReactNode> = {
  arch: ArchCover,
  letter: LetterCover,
  botanical: BotanicalCover,
  polaroid: PolaroidCover,
  envelope: EnvelopeCover,
  film: FilmCover,
  circle: CircleCover,
  magazine: MagazineCover,
  fullPhoto: FullPhotoCover,
  hanji: HanjiCover,
  split: SplitCover,
  watercolor: WatercolorCover,
  gingham: GinghamCover,
  balloon: BalloonCover,
  bear: BearCover,
  saekdong: SaekdongCover,
  starry: StarryCover,
  peony: PeonyCover,
  sunrise: SunriseCover,
};

export function Cover({ showHint = true }: { showHint?: boolean }) {
  const { theme } = useInv();
  const C = COVERS[theme.cover];
  return (
    <div className="relative">
      <C />
      {showHint && <ScrollHint />}
    </div>
  );
}

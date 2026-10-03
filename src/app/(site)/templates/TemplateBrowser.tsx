"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { EventType } from "@/types/invitation";
import { CATEGORY_LABEL, TEMPLATES } from "@/data/templates";
import { TemplateCard } from "@/components/site/TemplateCard";
import { useStored, writeStored } from "@/lib/localStore";
import { favoriteDesigns, searchDesigns } from "@/lib/design-search";

const EMPTY_FAVORITES: string[] = [];
const FAVORITES_KEY = "favorite-designs-v1";

type Filter = EventType | "all";
const TABS: { key: Filter; label: string; emoji: string }[] = [
  { key: "all", label: "전체", emoji: "✨" },
  { key: "wedding", label: "모바일 청첩장", emoji: "💍" },
  { key: "dol", label: "돌잔치", emoji: "🎈" },
  { key: "party", label: "부모님 잔치", emoji: "🌺" },
];

export function TemplateBrowser({ initialType }: { initialType: Filter }) {
  const router = useRouter();
  const [type, setType] = useState<Filter>(initialType);
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<"best" | "new">("best");
  const [query, setQuery] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [storageError, setStorageError] = useState("");
  const stored = useStored<unknown>(FAVORITES_KEY, EMPTY_FAVORITES);
  const favorites = favoriteDesigns(stored, TEMPLATES);
  const toggleFavorite = (id: string) => {
    try {
      writeStored(FAVORITES_KEY, favorites.includes(id) ? favorites.filter(value => value !== id) : [...favorites, id]);
      setStorageError("");
    } catch { setStorageError("이 브라우저에서 찜을 저장하지 못했어요. 저장 공간과 브라우저 설정을 확인해 주세요."); }
  };

  const byType = TEMPLATES.filter((t) => type === "all" || t.category === type);
  const tags = useMemo(() => Array.from(new Set(byType.flatMap((t) => t.tags))).slice(0, 14), [byType]);
  const list = searchDesigns(TEMPLATES, { type, tag, query, favorites: onlyFavorites ? favorites : undefined })
    .sort((a, b) => (sort === "best" ? Number(!!b.isBest) - Number(!!a.isBest) : Number(!!b.isNew) - Number(!!a.isNew)));

  const changeType = (t: Filter) => {
    setType(t);
    setTag(null);
    const url = t === "all" ? "/templates" : `/templates?type=${t}`;
    router.replace(url, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pb-10 pt-12">
      <div className="text-center">
        <p className="font-script text-[32px] text-brand-400">Choose your design</p>
        <h1 className="mt-1 text-[30px] font-bold">{type === "all" ? "마음에 드는 디자인을 골라보세요" : CATEGORY_LABEL[type]}</h1>
        <p className="mt-3 text-[13px] text-muted">사진은 AI로 만든 예시예요. 내 사진을 넣어 나만의 초대장을 만들 수 있어요.</p>
        <p className="mt-2 text-[15px] text-muted">카드를 누르면 실제 청첩장처럼 미리 볼 수 있어요</p>
      </div>

      <div className="no-scrollbar mt-10 flex justify-start gap-2 overflow-x-auto md:justify-center">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => changeType(t.key)}
            className={`shrink-0 rounded-full px-5 py-2.5 text-[15px] font-medium transition ${
              type === t.key ? "bg-ink text-white shadow-md" : "bg-white text-ink/70 hover:bg-brand-50"
            }`}
          >
            <span className="mr-1">{t.emoji}</span>
            {t.label}
            <span className="ml-1.5 text-[12px] opacity-60">
              {t.key === "all" ? TEMPLATES.length : TEMPLATES.filter((x) => x.category === t.key).length}
            </span>
          </button>
        ))}
      </div>

      <div className="mx-auto mt-6 max-w-xl">
        <label className="block text-sm font-medium">디자인 검색<input type="search" value={query} onChange={e => setQuery(e.target.value)} maxLength={100} placeholder="디자인 이름, 분위기, 꽃…" className="mt-2 min-h-11 w-full rounded-xl border border-black/10 bg-white px-4" /></label>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(v => !v)} className={`min-h-11 rounded-full border px-4 text-sm ${onlyFavorites ? "border-brand-400 bg-brand-50 text-brand-600" : "border-black/10 bg-white"}`}>찜한 디자인만 보기 ({favorites.length})</button>
          <span role="status" className="text-sm text-muted">디자인 {list.length}개</span>
        </div>
        <p className="mt-2 text-xs text-muted">찜은 이 브라우저에 저장돼요.</p>
        {storageError && <p role="alert" className="mt-2 text-sm text-red-700">{storageError}</p>}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 pb-5">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setTag(null)} className={`rounded-full border px-3 py-1.5 text-[13px] ${!tag ? "border-brand-400 bg-brand-50 text-brand-600" : "border-black/10 bg-white text-ink/60"}`}>
            #전체
          </button>
          {tags.map((t) => (
            <button key={t} onClick={() => setTag(t === tag ? null : t)} className={`rounded-full border px-3 py-1.5 text-[13px] ${tag === t ? "border-brand-400 bg-brand-50 text-brand-600" : "border-black/10 bg-white text-ink/60"}`}>
              #{t}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-full bg-white p-1 text-[13px]">
          {(["best", "new"] as const).map((s) => (
            <button key={s} onClick={() => setSort(s)} className={`rounded-full px-3 py-1.5 ${sort === s ? "bg-brand-500 text-white" : "text-ink/60"}`}>
              {s === "best" ? "인기순" : "신상품순"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((t) => (
          <div key={t.id} className="relative">
            <TemplateCard theme={t} />
            <button type="button" aria-label={`${t.name} ${favorites.includes(t.id) ? "찜 해제" : "찜하기"}`} aria-pressed={favorites.includes(t.id)} onClick={() => toggleFavorite(t.id)} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-brand-600 shadow-md">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-9-5.4-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.6-9 12-9 12Z" stroke="currentColor" strokeWidth="1.5" fill={favorites.includes(t.id) ? "currentColor" : "none"} /></svg>
            </button>
          </div>
        ))}
      </div>
      {!list.length && <div className="py-16 text-center"><p className="text-muted">조건에 맞는 디자인이 없어요</p><button type="button" onClick={() => { setQuery(""); setTag(null); setOnlyFavorites(false); changeType("all"); }} className="mt-4 min-h-11 rounded-full bg-ink px-5 text-sm text-white">검색 조건 지우기</button></div>}
    </div>
  );
}

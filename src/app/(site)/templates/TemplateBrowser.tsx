"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { EventType } from "@/types/invitation";
import { CATEGORY_LABEL, TEMPLATES } from "@/data/templates";
import { TemplateCard } from "@/components/site/TemplateCard";

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

  const byType = TEMPLATES.filter((t) => type === "all" || t.category === type);
  const tags = useMemo(() => Array.from(new Set(byType.flatMap((t) => t.tags))).slice(0, 14), [byType]);
  const list = byType
    .filter((t) => !tag || t.tags.includes(tag))
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
          <TemplateCard key={t.id} theme={t} />
        ))}
      </div>
      {!list.length && <p className="py-20 text-center text-muted">조건에 맞는 디자인이 없어요</p>}
    </div>
  );
}

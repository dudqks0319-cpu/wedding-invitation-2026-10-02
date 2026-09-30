import Link from "next/link";
import type { Theme } from "@/types/invitation";
import { createSample } from "@/data/samples";
import { CATEGORY_SHORT } from "@/data/templates";
import { CoverPreview } from "@/components/invitation/CoverPreview";

export function TemplateCard({ theme }: { theme: Theme }) {
  return (
    <Link href={`/templates/${theme.id}`} className="group block">
      <div className="relative overflow-hidden rounded-[22px] border border-black/5 bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_20px_40px_-12px_rgba(242,95,125,0.3)]">
        <CoverPreview invitation={createSample(theme)} theme={theme} />
        <div className="absolute left-3 top-3 flex gap-1.5">
          {theme.isBest && <span className="rounded-full bg-brand-500 px-2.5 py-1 text-[11px] font-bold text-white">BEST</span>}
          {theme.isNew && <span className="rounded-full bg-[#4FB39B] px-2.5 py-1 text-[11px] font-bold text-white">NEW</span>}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex translate-y-full justify-center bg-gradient-to-t from-black/40 to-transparent pb-4 pt-10 transition duration-300 group-hover:translate-y-0">
          <span className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-ink">미리보기</span>
        </div>
      </div>
      <div className="mt-3 px-1">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: theme.palette.accent }} />
          <p className="text-[15px] font-semibold text-ink">{theme.name}</p>
          <span className="text-[12px] text-muted">{CATEGORY_SHORT[theme.category]}</span>
        </div>
        <p className="mt-1 line-clamp-1 text-[13px] text-muted">{theme.description}</p>
      </div>
    </Link>
  );
}

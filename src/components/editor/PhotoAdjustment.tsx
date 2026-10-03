"use client";

import { useState } from "react";
import type { CoverPresentation } from "@/types/invitation";
import { DEFAULT_COVER, photoPresentationStyle } from "@/lib/presentation";

export function PhotoAdjustment({ src, value, onChange }: { src: string; value?: CoverPresentation; onChange(value: CoverPresentation): void }) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState<CoverPresentation>(DEFAULT_COVER);
  const button = "min-h-11 rounded-xl border border-black/10 px-4 text-[13px] font-medium";
  return <div>
    <button type="button" className={button} onClick={() => { setDraft({ ...(value ?? DEFAULT_COVER) }); setOpen(true); }}>사진 구도 조절</button>
    {open && <div className="mt-3 space-y-4 rounded-xl bg-cream p-4">
      <p className="text-[13px] text-muted">전체 사진을 미리 조절하고, 옆 청첩장 미리보기에서 디자인에 맞는 구도를 확인하세요.</p>
      <div className="mx-auto aspect-[3/4] w-full max-w-56 overflow-hidden rounded-xl bg-white"><img src={src} alt="사진 구도 미리보기" className="h-full w-full" style={photoPresentationStyle(draft)} /></div>
      <fieldset className="flex flex-wrap gap-2"><legend className="mb-2 text-sm font-medium">사진 맞춤</legend>{(["cover", "contain"] as const).map(fit => <button key={fit} type="button" aria-pressed={draft.fit === fit} className={`${button} ${draft.fit === fit ? "bg-ink text-white" : "bg-white"}`} onClick={() => setDraft(d => ({ ...d, fit, zoom: 1 }))}>{fit === "cover" ? "가득 채우기" : "사진 전체 보기"}</button>)}</fieldset>
      {([ ["x", "가로 위치", 0, 1, 0.01], ["y", "세로 위치", 0, 1, 0.01], ["zoom", "확대", 1, 2, 0.05] ] as const).map(([key, label, min, max, step]) => <label key={key} className="block text-sm">{label} <span className="text-muted">{key === "zoom" ? `${draft[key].toFixed(2)}배` : `${Math.round(draft[key] * 100)}%`}</span><input aria-label={label} type="range" min={min} max={max} step={step} value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: Number(e.target.value) }))} className="mt-2 h-8 w-full accent-brand-500" /></label>)}
      <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => setDraft({ ...DEFAULT_COVER })}>처음 구도로</button><button type="button" className={button} onClick={() => setOpen(false)}>취소</button><button type="button" className={`${button} bg-ink text-white`} onClick={() => { onChange(draft); setOpen(false); }}>구도 적용</button></div>
    </div>}
  </div>;
}

"use client";

import { useId, useState, type ReactNode } from "react";

export const inputCls =
  "w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-black/30 focus:border-brand-300 focus:ring-4 focus:ring-brand-100";

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink/80">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
  className,
  maxLength,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
  className?: string;
  maxLength?: number;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <input className={inputCls} type={type} value={value ?? ""} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function TextArea({ label, value, onChange, rows = 6, placeholder }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <Field label={label}>
      <textarea className={`${inputCls} resize-y leading-7`} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function Select({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: (string | [string, string])[]; className?: string }) {
  return (
    <Field label={label} className={className}>
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </Field>
  );
}

export function Toggle({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <label htmlFor={id} className="cursor-pointer">
        <p className="text-[14px] font-medium text-ink">{label}</p>
        {desc && <p className="text-[12px] text-muted">{desc}</p>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-brand-500" : "bg-black/15"}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-ink/70">
      <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** 접었다 펼 수 있는 편집 묶음 */
export function Panel({ title, emoji, children, defaultOpen = false, badge }: { title: string; emoji: string; children: ReactNode; defaultOpen?: boolean; badge?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_2px_12px_-6px_rgba(0,0,0,0.08)]">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-4" aria-expanded={open}>
        <span className="flex items-center gap-2.5 text-[15px] font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-[16px]">{emoji}</span>
          {title}
          {badge && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">{badge}</span>}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" className={`text-muted transition ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </button>
      {open && <div className="space-y-4 border-t border-black/5 px-5 pb-6 pt-5">{children}</div>}
    </section>
  );
}

"use client";

import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import type { Account, Partner } from "@/types/invitation";
import { diffFromNow, monthMatrix, parseDateTime, WEEKDAYS, formatKoreanDate, formatKoreanTime } from "@/lib/date";
import { kakaoMapUrl, naverMapUrl, tmapUrl } from "@/lib/maps";
import { addGuestbook, removeGuestbook, submitRsvp, useGuestbook } from "@/lib/api";
import { MapEmbed } from "./MapEmbed";
import { HeartIcon } from "./Ornaments";
import { Photo, Section, SectionTitle, copyText, useInv } from "./shared";

/* ─────────────── 공용 작은 부품 ─────────────── */

function Button({
  children,
  onClick,
  variant = "outline",
  className = "",
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "outline" | "solid" | "soft";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const style =
    variant === "solid"
      ? { background: "var(--inv-accent)", color: "#fff", borderColor: "var(--inv-accent)" }
      : variant === "soft"
        ? { background: "var(--inv-accent-soft)", color: "var(--inv-text)", borderColor: "transparent" }
        : { background: "var(--inv-surface)", color: "var(--inv-text)", borderColor: "var(--inv-line)" };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-[13px] transition active:scale-[0.97] disabled:opacity-50 ${className}`}
      style={{ ...style, fontFamily: "var(--font-sans)" }}
    >
      {children}
    </button>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { mode } = useInv();
  if (!open) return null;
  return (
    <div
      className={`${mode === "page" ? "fixed" : "absolute"} inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center`}
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label={title}
    >
      <div
        className="max-h-[85%] w-full max-w-[480px] overflow-y-auto rounded-t-3xl p-6 pb-8 animate-fade-up sm:rounded-3xl"
        style={{ background: "var(--inv-surface)", color: "var(--inv-text)", fontFamily: "var(--font-sans)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-[16px] font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="닫기" className="rounded-full p-1 opacity-60 hover:opacity-100">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border px-4 py-3 text-[14px] outline-none transition focus:ring-2";
const inputStyle = { borderColor: "var(--inv-line)", background: "var(--inv-bg)", color: "var(--inv-text)", "--tw-ring-color": "var(--inv-accent-soft)" } as React.CSSProperties;

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" fill="currentColor" />
    </svg>
  );
}
function SmsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z" fill="currentColor" />
    </svg>
  );
}

/* ─────────────── 1. 인사말 + 혼주 ─────────────── */

function ParentLine({ p, role }: { p: Partner; role: string }) {
  const parents = [
    p.father && (
      <span key="f">
        {p.fatherDeceased && <span className="mr-0.5 text-[12px] opacity-60">故</span>}
        {p.father}
      </span>
    ),
    p.mother && (
      <span key="m">
        {p.motherDeceased && <span className="mr-0.5 text-[12px] opacity-60">故</span>}
        {p.mother}
      </span>
    ),
  ].filter(Boolean);
  return (
    <p className="flex flex-wrap items-baseline justify-center gap-x-1.5 text-[15px]">
      {parents.map((el, i) => (
        <span key={i} className="flex items-baseline gap-1.5">
          {i > 0 && <span className="opacity-40">·</span>}
          {el}
        </span>
      ))}
      <span className="text-[13px]" style={{ color: "var(--inv-subtext)" }}>
        의 {p.order}
      </span>
      <span className="ml-1 font-bold">{p.name}</span>
      <span className="sr-only">({role})</span>
    </p>
  );
}

export function GreetingSection() {
  const { inv } = useInv();
  const [contactOpen, setContactOpen] = useState(false);

  const contacts: { group: string; items: { label: string; name: string; phone?: string }[] }[] = [];
  if (inv.type === "wedding" && inv.wedding) {
    const { groom, bride } = inv.wedding;
    contacts.push(
      {
        group: "신랑측",
        items: [
          { label: "신랑", name: groom.name, phone: groom.phone },
          { label: "아버지", name: groom.father ?? "", phone: groom.fatherDeceased ? undefined : groom.fatherPhone },
          { label: "어머니", name: groom.mother ?? "", phone: groom.motherDeceased ? undefined : groom.motherPhone },
        ],
      },
      {
        group: "신부측",
        items: [
          { label: "신부", name: bride.name, phone: bride.phone },
          { label: "아버지", name: bride.father ?? "", phone: bride.fatherDeceased ? undefined : bride.fatherPhone },
          { label: "어머니", name: bride.mother ?? "", phone: bride.motherDeceased ? undefined : bride.motherPhone },
        ],
      },
    );
  } else if (inv.type === "dol" && inv.dol) {
    contacts.push({
      group: "아기 부모님",
      items: [
        { label: "아빠", name: inv.dol.father, phone: inv.dol.phone },
        { label: "엄마", name: inv.dol.mother, phone: inv.dol.phone },
      ],
    });
  } else if (inv.party) {
    contacts.push({ group: "초대하는 분", items: [{ label: inv.party.hostName, name: "", phone: inv.party.phone }] });
  }

  return (
    <Section>
      <SectionTitle en="Invitation" ko={inv.greetingTitle} />
      <p className="whitespace-pre-line text-center text-[15px] leading-[2.1]">{inv.greeting}</p>

      <div className="mx-auto my-12 h-12 w-px" style={{ background: "var(--inv-line)" }} />

      <div className="space-y-3 text-center">
        {inv.type === "wedding" && inv.wedding && (
          <>
            <ParentLine p={inv.wedding.groom} role="신랑" />
            <ParentLine p={inv.wedding.bride} role="신부" />
          </>
        )}
        {inv.type === "dol" && inv.dol && (
          <p className="text-[15px]">
            <span style={{ color: "var(--inv-subtext)" }}>아빠</span> {inv.dol.father}
            <span className="mx-2 opacity-40">·</span>
            <span style={{ color: "var(--inv-subtext)" }}>엄마</span> {inv.dol.mother}
            <span className="text-[13px]" style={{ color: "var(--inv-subtext)" }}> 의 사랑스러운 </span>
            <b>{inv.dol.babyName}</b>
          </p>
        )}
        {inv.type === "party" && inv.party && (
          <p className="text-[15px]">
            {inv.party.hostName} <span style={{ color: "var(--inv-subtext)" }}>올림</span>
          </p>
        )}
      </div>

      <div className="mt-10 flex justify-center">
        <Button onClick={() => setContactOpen(true)} variant="soft" className="px-6">
          <PhoneIcon /> 연락하기
        </Button>
      </div>

      <Modal open={contactOpen} onClose={() => setContactOpen(false)} title="연락하기">
        <div className="space-y-6">
          {contacts.map((c) => (
            <div key={c.group}>
              <p className="mb-2 text-[13px] font-semibold" style={{ color: "var(--inv-accent)" }}>
                {c.group}
              </p>
              <ul className="divide-y" style={{ borderColor: "var(--inv-line)" }}>
                {c.items
                  .filter((it) => it.name || it.phone)
                  .map((it) => (
                    <li key={it.label + it.name} className="flex items-center justify-between py-3 text-[14px]" style={{ borderColor: "var(--inv-line)" }}>
                      <span>
                        <span className="mr-2 text-[12px]" style={{ color: "var(--inv-subtext)" }}>
                          {it.label}
                        </span>
                        {it.name}
                      </span>
                      {it.phone ? (
                        <span className="flex gap-2">
                          <a href={`tel:${it.phone}`} className="rounded-full p-2" style={{ background: "var(--inv-accent-soft)", color: "var(--inv-accent)" }} aria-label={`${it.label}에게 전화`}>
                            <PhoneIcon />
                          </a>
                          <a href={`sms:${it.phone}`} className="rounded-full p-2" style={{ background: "var(--inv-accent-soft)", color: "var(--inv-accent)" }} aria-label={`${it.label}에게 문자`}>
                            <SmsIcon />
                          </a>
                        </span>
                      ) : (
                        <span className="text-[12px] opacity-40">-</span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Modal>
    </Section>
  );
}

/* ─────────────── 2. 날짜 + 달력 + D-day ─────────────── */

function subscribeClock(cb: () => void) {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
}

export function DateSection() {
  const { inv, d } = useInv();
  const { year, month, day } = parseDateTime(inv.dateTime);
  const cells = monthMatrix(year, month);
  const nowSec = useSyncExternalStore(subscribeClock, () => Math.floor(Date.now() / 1000), () => 0);
  const diff = nowSec ? diffFromNow(inv.dateTime, nowSec * 1000) : null;
  const who =
    inv.type === "wedding" ? `${d.shortNames[0]} ♥ ${d.shortNames[1]}의 결혼식` : inv.type === "dol" ? `${d.shortNames[0]}의 돌잔치` : `${d.names[0]}님의 ${inv.party?.eventName ?? "잔치"}`;

  return (
    <Section tinted>
      <SectionTitle en="Save the Date" ko={inv.type === "wedding" ? "예식 일시" : "행사 일시"} />
      <p className="inv-title text-center text-[20px]">{formatKoreanDate(inv.dateTime)}</p>
      <p className="mt-1 text-center text-[15px]" style={{ color: "var(--inv-subtext)" }}>
        {formatKoreanTime(inv.dateTime)}
      </p>

      {inv.options.showCalendar && (
        <div className="mx-auto mt-10 max-w-[320px] rounded-3xl px-4 py-6" style={{ background: "var(--inv-surface)" }}>
          <p className="mb-4 text-center text-[15px] font-semibold tracking-[0.2em]">
            {year}. {String(month).padStart(2, "0")}
          </p>
          <div className="grid grid-cols-7 gap-y-2 text-center text-[13px]" style={{ fontFamily: "var(--font-sans)" }}>
            {WEEKDAYS.map((w, i) => (
              <span key={w} className="pb-2 text-[11px] font-semibold" style={{ color: i === 0 ? "#E57373" : i === 6 ? "#6FA3D6" : "var(--inv-subtext)" }}>
                {w}
              </span>
            ))}
            {cells.map((c, i) => {
              const isDay = c === day;
              const col = i % 7;
              return (
                <span key={i} className="flex h-9 items-center justify-center">
                  {c && (
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${isDay ? "font-bold text-white shadow-md" : ""}`}
                      style={
                        isDay
                          ? { background: "var(--inv-accent)" }
                          : { color: col === 0 ? "#E57373" : col === 6 ? "#6FA3D6" : "var(--inv-text)" }
                      }
                    >
                      {c}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {inv.options.showDday && (
        <div className="mt-10 text-center">
          <div className="flex justify-center gap-2.5" style={{ fontFamily: "var(--font-sans)" }}>
            {(
              [
                ["DAYS", diff?.days],
                ["HOUR", diff?.hours],
                ["MIN", diff?.minutes],
                ["SEC", diff?.seconds],
              ] as const
            ).map(([label, v]) => (
              <div key={label} className="w-[62px] rounded-2xl py-3" style={{ background: "var(--inv-surface)" }}>
                <p className="text-[22px] font-semibold tabular-nums" style={{ color: "var(--inv-accent)" }}>
                  {v === undefined ? "--" : String(v).padStart(2, "0")}
                </p>
                <p className="text-[10px] tracking-widest" style={{ color: "var(--inv-subtext)" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[14px]">
            {who}이{" "}
            {diff === null ? (
              "곧 다가옵니다"
            ) : diff.dday > 0 ? (
              <>
                <b style={{ color: "var(--inv-accent)" }}>{diff.dday}일</b> 남았습니다
              </>
            ) : diff.dday === 0 ? (
              <b style={{ color: "var(--inv-accent)" }}>오늘입니다!</b>
            ) : (
              "진행되었습니다. 감사합니다"
            )}
          </p>
        </div>
      )}
    </Section>
  );
}

/* ─────────────── 3. 갤러리 ─────────────── */

export function GallerySection() {
  const { inv, mode } = useInv();
  const [showAll, setShowAll] = useState(false);
  const [index, setIndex] = useState<number | null>(null);
  const [touchX, setTouchX] = useState<number | null>(null);
  const photos = inv.gallery.filter(Boolean);
  if (!photos.length) return null;
  const visible = showAll ? photos : photos.slice(0, 9);
  const go = (delta: number) => setIndex((i) => (i === null ? i : (i + delta + photos.length) % photos.length));

  return (
    <Section>
      <SectionTitle en="Gallery" ko="우리의 순간" />
      <div className="grid grid-cols-3 gap-1.5">
        {visible.map((src, i) => (
          <button key={src + i} onClick={() => setIndex(i)} className="group overflow-hidden rounded-lg" aria-label={`사진 ${i + 1} 크게 보기`}>
            <Photo src={src} className="aspect-square w-full transition duration-500 group-hover:scale-105" />
          </button>
        ))}
      </div>
      {photos.length > 9 && (
        <div className="mt-6 flex justify-center">
          <Button onClick={() => setShowAll((v) => !v)}>{showAll ? "접기" : `사진 더보기 (${photos.length - 9})`}</Button>
        </div>
      )}

      {index !== null && (
        <div
          className={`${mode === "page" ? "fixed" : "absolute"} inset-0 z-40 flex flex-col bg-black/92`}
          role="dialog"
          aria-modal
          aria-label="사진 크게 보기"
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX === null) return;
            const dx = e.changedTouches[0].clientX - touchX;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            setTouchX(null);
          }}
        >
          <div className="flex items-center justify-between px-5 py-4 text-white/80" style={{ fontFamily: "var(--font-sans)" }}>
            <span className="text-[13px] tabular-nums">
              {index + 1} / {photos.length}
            </span>
            <button onClick={() => setIndex(null)} aria-label="닫기" className="p-1">
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-2">
            <img src={photos[index]} alt="" className="max-h-full max-w-full object-contain" />
            <button onClick={() => go(-1)} className="absolute left-2 rounded-full bg-white/15 p-2 text-white" aria-label="이전 사진">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </button>
            <button onClick={() => go(1)} className="absolute right-2 rounded-full bg-white/15 p-2 text-white" aria-label="다음 사진">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </button>
          </div>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 py-4">
            {photos.map((src, i) => (
              <button key={src + i} onClick={() => setIndex(i)} className={`shrink-0 overflow-hidden rounded ${i === index ? "ring-2 ring-white" : "opacity-50"}`}>
                <img src={src} alt="" className="h-12 w-12 object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

/* ─────────────── 4. 오시는 길 ─────────────── */

function MapAppButton({ href, label, color, letter }: { href: string; label: string; color: string; letter: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-3 text-[12px] transition active:scale-[0.97]"
      style={{ borderColor: "var(--inv-line)", background: "var(--inv-surface)", fontFamily: "var(--font-sans)" }}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-black text-white" style={{ background: color }}>
        {letter}
      </span>
      {label}
    </a>
  );
}

function TransportRow({ icon, title, text }: { icon: string; title: string; text?: string }) {
  if (!text) return null;
  return (
    <div className="flex gap-3 py-4" style={{ borderTop: "1px solid var(--inv-line)" }}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px]" style={{ background: "var(--inv-accent-soft)" }} aria-hidden>
        {icon}
      </span>
      <div>
        <p className="text-[14px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[13px] leading-6" style={{ color: "var(--inv-subtext)" }}>
          {text}
        </p>
      </div>
    </div>
  );
}

export function LocationSection() {
  const { inv, toast } = useInv();
  const v = inv.venue;
  return (
    <Section tinted>
      <SectionTitle en="Location" ko="오시는 길" />
      <div className="text-center">
        <p className="inv-title text-[20px] font-bold">{v.name}</p>
        {v.hall && <p className="text-[14px]" style={{ color: "var(--inv-subtext)" }}>{v.hall}</p>}
        <p className="mt-2 text-[14px]">{v.address}</p>
        <div className="mt-3 flex justify-center gap-2">
          <Button
            onClick={async () => {
              await copyText(v.address);
              toast("주소가 복사되었어요");
            }}
            className="px-3 py-1.5 text-[12px]"
          >
            주소 복사
          </Button>
          {v.tel && (
            <a href={`tel:${v.tel}`} className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px]" style={{ borderColor: "var(--inv-line)", background: "var(--inv-surface)", fontFamily: "var(--font-sans)" }}>
              <PhoneIcon /> {v.tel}
            </a>
          )}
        </div>
      </div>

      <div className="mt-8">
        <MapEmbed venue={v} />
      </div>
      <div className="mt-3 flex gap-2">
        <MapAppButton href={naverMapUrl(v)} label="네이버지도" color="#03C75A" letter="N" />
        <MapAppButton href={kakaoMapUrl(v)} label="카카오맵" color="#FFCD00" letter="K" />
        <MapAppButton href={tmapUrl(v)} label="티맵" color="#4A5CFF" letter="T" />
      </div>

      <div className="mt-8 rounded-2xl px-5" style={{ background: "var(--inv-surface)" }}>
        <div className="-mt-px">
          <TransportRow icon="🚇" title="지하철" text={v.subway} />
          <TransportRow icon="🚌" title="버스" text={v.bus} />
          <TransportRow icon="🅿️" title="주차" text={v.parking} />
          <TransportRow icon="🚗" title="자가용" text={v.car} />
        </div>
      </div>
    </Section>
  );
}

/* ─────────────── 5. 마음 전하실 곳 ─────────────── */

function AccountGroup({ title, accounts }: { title: string; accounts: Account[] }) {
  const { toast } = useInv();
  const [open, setOpen] = useState(false);
  if (!accounts.length) return null;
  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--inv-line)", background: "var(--inv-surface)" }}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-4 text-[15px]" aria-expanded={open}>
        <span className="font-semibold">{title}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" className={`transition ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </button>
      {open && (
        <ul style={{ fontFamily: "var(--font-sans)" }}>
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: "1px solid var(--inv-line)", background: "var(--inv-bg)" }}>
              <div className="min-w-0 text-[13px]">
                <p style={{ color: "var(--inv-subtext)" }}>
                  {a.label} · {a.holder}
                </p>
                <p className="mt-0.5 truncate text-[14px] font-medium">
                  {a.bank} {a.number}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {a.kakaoPayUrl && (
                  <a href={a.kakaoPayUrl} className="rounded-lg bg-[#FFEB00] px-2.5 py-1.5 text-[11px] font-bold text-[#3C1E1E]">
                    pay
                  </a>
                )}
                <button
                  onClick={async () => {
                    await copyText(`${a.bank} ${a.number} ${a.holder}`);
                    toast("계좌번호가 복사되었어요");
                  }}
                  className="rounded-lg border px-2.5 py-1.5 text-[11px]"
                  style={{ borderColor: "var(--inv-line)", background: "var(--inv-surface)" }}
                >
                  복사
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AccountSection() {
  const { inv } = useInv();
  if (!inv.accounts.length) return null;
  const groups =
    inv.type === "wedding"
      ? [
          { title: "신랑측 계좌번호", accounts: inv.accounts.filter((a) => a.side === "groom") },
          { title: "신부측 계좌번호", accounts: inv.accounts.filter((a) => a.side === "bride") },
        ]
      : [{ title: "계좌번호 보기", accounts: inv.accounts }];
  return (
    <Section>
      <SectionTitle en="With Heart" ko="마음 전하실 곳" />
      <p className="mb-8 text-center text-[14px] leading-7" style={{ color: "var(--inv-subtext)" }}>
        참석이 어려워 직접 축하를 전하지 못하는 분들을 위해
        <br />
        계좌번호를 기재하였습니다.
        <br />
        넓은 마음으로 양해 부탁드립니다.
      </p>
      <div className="space-y-3">
        {groups.map((g) => (
          <AccountGroup key={g.title} {...g} />
        ))}
      </div>
    </Section>
  );
}

/* ─────────────── 6. 참석 여부 (RSVP) ─────────────── */

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-xl border py-3 text-[14px] transition"
      style={active ? { background: "var(--inv-accent)", color: "#fff", borderColor: "var(--inv-accent)" } : { borderColor: "var(--inv-line)" }}
    >
      {children}
    </button>
  );
}

export function RsvpSection() {
  const { inv, readOnly, toast } = useInv();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ side: inv.type === "wedding" ? "groom" : "host", name: "", attending: true, count: 1, meal: "yes", memo: "" });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast("성함을 입력해 주세요");
    if (readOnly) {
      setOpen(false);
      return toast("미리보기에서는 저장되지 않아요");
    }
    await submitRsvp(inv.slug, {
      side: form.side as "groom" | "bride" | "host",
      name: form.name.trim(),
      attending: form.attending,
      count: form.count,
      meal: form.meal as "yes" | "no" | "unknown",
      memo: form.memo,
    });
    setOpen(false);
    setForm((f) => ({ ...f, name: "", memo: "" }));
    toast("참석 의사가 전달되었어요. 감사합니다!");
  };

  return (
    <Section tinted>
      <SectionTitle en="R.S.V.P" ko="참석 의사 전달" />
      <div className="rounded-3xl px-6 py-8 text-center" style={{ background: "var(--inv-surface)" }}>
        <p className="text-[14px] leading-7">
          축하의 마음으로 참석해 주시는 분들을
          <br />더 정성껏 모실 수 있도록
          <br />
          참석 여부를 미리 알려주세요.
        </p>
        <Button onClick={() => setOpen(true)} variant="solid" className="mt-6 px-8">
          참석 의사 전달하기
        </Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="참석 의사 전달">
        <form onSubmit={submit} className="space-y-5 text-[14px]">
          {inv.type === "wedding" && (
            <div>
              <p className="mb-2 font-medium">어느 쪽 하객이신가요?</p>
              <div className="flex gap-2">
                <Choice active={form.side === "groom"} onClick={() => setForm({ ...form, side: "groom" })}>
                  신랑측
                </Choice>
                <Choice active={form.side === "bride"} onClick={() => setForm({ ...form, side: "bride" })}>
                  신부측
                </Choice>
              </div>
            </div>
          )}
          <div>
            <p className="mb-2 font-medium">참석 여부</p>
            <div className="flex gap-2">
              <Choice active={form.attending} onClick={() => setForm({ ...form, attending: true })}>
                참석할게요
              </Choice>
              <Choice active={!form.attending} onClick={() => setForm({ ...form, attending: false })}>
                어려워요
              </Choice>
            </div>
          </div>
          <label className="block">
            <span className="mb-2 block font-medium">성함</span>
            <input className={inputCls} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="홍길동" maxLength={20} />
          </label>
          {form.attending && (
            <>
              <div>
                <p className="mb-2 font-medium">본인 포함 참석 인원</p>
                <div className="flex items-center gap-3">
                  <button type="button" className="h-10 w-10 rounded-full border" style={{ borderColor: "var(--inv-line)" }} onClick={() => setForm({ ...form, count: Math.max(1, form.count - 1) })} aria-label="인원 줄이기">
                    −
                  </button>
                  <span className="w-10 text-center text-[16px] font-semibold tabular-nums">{form.count}</span>
                  <button type="button" className="h-10 w-10 rounded-full border" style={{ borderColor: "var(--inv-line)" }} onClick={() => setForm({ ...form, count: Math.min(20, form.count + 1) })} aria-label="인원 늘리기">
                    +
                  </button>
                  <span className="text-[13px]" style={{ color: "var(--inv-subtext)" }}>명</span>
                </div>
              </div>
              <div>
                <p className="mb-2 font-medium">식사 여부</p>
                <div className="flex gap-2">
                  <Choice active={form.meal === "yes"} onClick={() => setForm({ ...form, meal: "yes" })}>예정</Choice>
                  <Choice active={form.meal === "no"} onClick={() => setForm({ ...form, meal: "no" })}>안 함</Choice>
                  <Choice active={form.meal === "unknown"} onClick={() => setForm({ ...form, meal: "unknown" })}>미정</Choice>
                </div>
              </div>
            </>
          )}
          <label className="block">
            <span className="mb-2 block font-medium">전달 메모 (선택)</span>
            <input className={inputCls} style={inputStyle} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="예) 아이 1명 동반해요" maxLength={60} />
          </label>
          <Button type="submit" variant="solid" className="w-full py-3.5 text-[15px]">
            전달하기
          </Button>
        </form>
      </Modal>
    </Section>
  );
}

/* ─────────────── 7. 방명록 ─────────────── */

const DEMO_GUESTBOOK = [
  { id: "demo1", name: "지현", message: "두 사람 너무 잘 어울려요! 행복하게 오래오래 사랑하길 💕", createdAt: "2027-03-02T10:00:00Z" },
  { id: "demo2", name: "대리 박성우", message: "진심으로 축하드립니다. 예쁜 가정 이루세요!", createdAt: "2027-03-01T09:00:00Z" },
];

export function GuestbookSection() {
  const { inv, readOnly, toast } = useInv();
  const stored = useGuestbook(inv.slug);
  const list = stored.length || !inv.slug.startsWith("sample-") ? stored : DEMO_GUESTBOOK;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", password: "", message: "" });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) return toast("이름과 메시지를 입력해 주세요");
    if (form.password.length < 4) return toast("비밀번호는 4자리 이상 입력해 주세요");
    if (readOnly) {
      setOpen(false);
      return toast("미리보기에서는 저장되지 않아요");
    }
    await addGuestbook(inv.slug, { name: form.name.trim(), message: form.message.trim(), password: form.password });
    setForm({ name: "", password: "", message: "" });
    setOpen(false);
    toast("축하 메시지가 등록되었어요");
  };

  return (
    <Section>
      <SectionTitle en="Guestbook" ko="축하 메시지" />
      <div className="space-y-3">
        {list.length === 0 && (
          <p className="rounded-2xl py-10 text-center text-[14px]" style={{ background: "var(--inv-surface-tint)", color: "var(--inv-subtext)" }}>
            첫 번째 축하 메시지를 남겨주세요
          </p>
        )}
        {list.slice(0, 6).map((g) => (
          <div key={g.id} className="rounded-2xl px-5 py-4" style={{ background: "var(--inv-surface-tint)" }}>
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-semibold">{g.name}</span>
              <span className="flex items-center gap-2" style={{ color: "var(--inv-subtext)", fontFamily: "var(--font-sans)" }}>
                <span className="text-[11px]">{g.createdAt.slice(0, 10).replaceAll("-", ".")}</span>
                {!g.id.startsWith("demo") && !readOnly && (
                  <button
                    onClick={async () => {
                      if (confirm("이 메시지를 삭제할까요?")) {
                        await removeGuestbook(inv.slug, g.id);
                        toast("삭제되었어요");
                      }
                    }}
                    className="text-[11px] underline opacity-60"
                  >
                    삭제
                  </button>
                )}
              </span>
            </div>
            <p className="mt-1.5 whitespace-pre-line text-[14px] leading-6">{g.message}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        <Button onClick={() => setOpen(true)} className="px-6">
          <HeartIcon size={14} color="var(--inv-accent)" /> 축하 메시지 남기기
        </Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="축하 메시지 남기기">
        <form onSubmit={submit} className="space-y-3 text-[14px]">
          <div className="flex gap-2">
            <input className={inputCls} style={inputStyle} placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={12} />
            <input className={inputCls} style={inputStyle} placeholder="비밀번호" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} maxLength={20} />
          </div>
          <textarea className={`${inputCls} h-32 resize-none`} style={inputStyle} placeholder="따뜻한 축하의 말을 남겨주세요" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={300} />
          <p className="text-right text-[11px]" style={{ color: "var(--inv-subtext)" }}>
            {form.message.length}/300
          </p>
          <Button type="submit" variant="solid" className="w-full py-3.5 text-[15px]">
            등록하기
          </Button>
        </form>
      </Modal>
    </Section>
  );
}

/* ─────────────── 8. 마무리 + 공유 ─────────────── */

export function EndingSection() {
  const { inv, d, toast } = useInv();
  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    // TODO(backend/키): 카카오 JavaScript 키가 생기면 Kakao.Share.sendDefault 로 교체
    if (navigator.share) {
      try {
        await navigator.share({ title: inv.shareTitle ?? d.headline, text: inv.shareDescription, url });
        return;
      } catch {
        /* 사용자가 취소 */
      }
    }
    await copyText(url);
    toast("카카오톡 공유는 키 연동 후 사용할 수 있어요. 링크를 복사했어요!");
  };
  return (
    <section className="relative px-7 pb-16 pt-20 text-center">
      <Photo src={inv.coverPhoto} className="mx-auto aspect-square w-40 rounded-full" />
      <p className="inv-script mt-8 text-[30px]" style={{ color: "var(--inv-accent)" }}>
        Thank you
      </p>
      <p className="mt-4 whitespace-pre-line text-[14px] leading-7" style={{ color: "var(--inv-subtext)" }}>
        {inv.type === "wedding"
          ? "저희의 새 출발을 축복해 주시는\n모든 분들께 진심으로 감사드립니다."
          : "귀한 걸음으로 함께해 주시는\n모든 분들께 진심으로 감사드립니다."}
      </p>
      <div className="mt-10 flex flex-col gap-2.5">
        <button onClick={share} className="flex items-center justify-center gap-2 rounded-xl bg-[#FEE500] py-3.5 text-[14px] font-semibold text-[#191919]" style={{ fontFamily: "var(--font-sans)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7l-1 3.7c-.1.4.3.6.6.4l4.3-2.9c.5.1.9.1 1.4.1 5.5 0 10-3.6 10-8S17.5 3 12 3z" fill="#191919" />
          </svg>
          카카오톡으로 공유하기
        </button>
        <button
          onClick={async () => {
            await copyText(window.location.href);
            toast("청첩장 링크가 복사되었어요");
          }}
          className="rounded-xl border py-3.5 text-[14px]"
          style={{ borderColor: "var(--inv-line)", background: "var(--inv-surface)", fontFamily: "var(--font-sans)" }}
        >
          링크 복사하기
        </button>
      </div>
    </section>
  );
}

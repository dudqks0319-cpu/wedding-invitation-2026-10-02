"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import type { Account, Invitation, Partner, Theme } from "@/types/invitation";
import { TEMPLATES, getTemplate } from "@/data/templates";
import { ALL_PHOTO_KEYS, photo } from "@/data/photos";
import { newId, saveInvitation } from "@/lib/api";
import { resizeImage } from "@/lib/image";
import { InvitationView } from "@/components/invitation/InvitationView";
import { PhoneFrame } from "@/components/site/PhoneFrame";
import { Logo } from "@/components/site/Logo";
import { Checkbox, Field, Panel, Select, TextArea, TextInput, Toggle, inputCls } from "./fields";

const BANKS = ["국민은행", "신한은행", "우리은행", "하나은행", "농협은행", "기업은행", "카카오뱅크", "토스뱅크", "케이뱅크", "SC제일은행", "대구은행", "부산은행", "새마을금고", "우체국", "수협"];

const GREETING_PRESETS: Record<Invitation["type"], { title: string; text: string }[]> = {
  wedding: [
    { title: "소중한 분들을 초대합니다", text: "서로 다른 길을 걸어온 두 사람이\n이제 같은 곳을 바라보며\n한 길을 함께 걸어가려 합니다.\n\n저희의 새로운 시작을\n가까이에서 축복해 주시면\n더없는 기쁨으로 간직하겠습니다." },
    { title: "저희 결혼합니다", text: "봄날의 햇살처럼 따뜻한 사람을 만나\n평생을 함께하기로 약속했습니다.\n\n바쁘시더라도 오셔서\n저희의 첫걸음을 축하해 주세요." },
    { title: "사랑이 결실을 맺는 날", text: "오랜 기다림 끝에\n서로의 반쪽이 되려 합니다.\n\n귀한 걸음 하시어\n저희의 앞날을 축복해 주시면\n감사하겠습니다." },
  ],
  dol: [
    { title: "첫 번째 생일에 초대합니다", text: "작고 여린 손으로 저희에게 와\n온 세상을 환하게 밝혀준 아이가\n벌써 첫 번째 생일을 맞이했습니다.\n\n오셔서 축복해 주세요." },
    { title: "우리 아기 돌잔치", text: "건강하게 자라준 아이에게\n가장 큰 선물은 여러분의 축복입니다.\n\n소중한 날, 함께해 주세요." },
  ],
  party: [
    { title: "감사의 자리에 초대합니다", text: "평생을 가족을 위해 헌신하신\n부모님의 생신을 맞아\n작은 자리를 마련했습니다.\n\n귀한 걸음 하시어\n축하해 주시면 감사하겠습니다." },
    { title: "건강과 장수를 기원하며", text: "늘 곁에서 든든한 버팀목이 되어주신\n부모님께 감사의 마음을 전하고자 합니다.\n\n함께 축하해 주세요." },
  ],
};

const SAMPLE_PHOTOS = Array.from(new Set(ALL_PHOTO_KEYS.map(photo)));

type Updater = (fn: (draft: Invitation) => void) => void;

/* ─────────── 신랑/신부 입력 묶음 ─────────── */
function PartnerFields({ who, p, onChange }: { who: "신랑" | "신부"; p: Partner; onChange: (fn: (p: Partner) => void) => void }) {
  return (
    <div className="space-y-3 rounded-xl bg-cream p-4">
      <p className="text-[13px] font-bold text-brand-600">{who}</p>
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="이름" value={p.name} onChange={(v) => onChange((x) => void (x.name = v))} placeholder="김민준" maxLength={10} />
        <TextInput label="영문 이름" value={p.englishName} onChange={(v) => onChange((x) => void (x.englishName = v))} placeholder="Minjun" maxLength={20} />
        <Select label="관계" value={p.order} onChange={(v) => onChange((x) => void (x.order = v))} options={who === "신랑" ? ["아들", "장남", "차남", "삼남", "막내"] : ["딸", "장녀", "차녀", "삼녀", "막내"]} />
        <TextInput label="연락처" value={p.phone} onChange={(v) => onChange((x) => void (x.phone = v))} placeholder="010-0000-0000" type="tel" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <TextInput label="아버지 성함" value={p.father} onChange={(v) => onChange((x) => void (x.father = v))} />
          <Checkbox label="故 표시" checked={!!p.fatherDeceased} onChange={(v) => onChange((x) => void (x.fatherDeceased = v))} />
        </div>
        <div className="space-y-1.5">
          <TextInput label="어머니 성함" value={p.mother} onChange={(v) => onChange((x) => void (x.mother = v))} />
          <Checkbox label="故 표시" checked={!!p.motherDeceased} onChange={(v) => onChange((x) => void (x.motherDeceased = v))} />
        </div>
        {!p.fatherDeceased && <TextInput label="아버지 연락처" value={p.fatherPhone} onChange={(v) => onChange((x) => void (x.fatherPhone = v))} type="tel" />}
        {!p.motherDeceased && <TextInput label="어머니 연락처" value={p.motherPhone} onChange={(v) => onChange((x) => void (x.motherPhone = v))} type="tel" />}
      </div>
    </div>
  );
}

/* ─────────── 사진 올리기 ─────────── */
function PhotoPicker({ inv, update, toast }: { inv: Invitation; update: Updater; toast: (m: string) => void }) {
  const coverInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onCover = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    try {
      const url = await resizeImage(f);
      update((d) => void (d.coverPhoto = url));
    } catch (err) {
      toast((err as Error).message);
    }
    setBusy(false);
  };

  const onGallery = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 30 - inv.gallery.length);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      const urls = await Promise.all(files.map((f) => resizeImage(f, 1000, 0.78)));
      update((d) => void d.gallery.push(...urls));
    } catch (err) {
      toast((err as Error).message);
    }
    setBusy(false);
  };

  const move = (i: number, delta: number) =>
    update((d) => {
      const j = i + delta;
      if (j < 0 || j >= d.gallery.length) return;
      [d.gallery[i], d.gallery[j]] = [d.gallery[j], d.gallery[i]];
    });

  return (
    <>
      <Field label="대표 사진 (표지)">
        <div className="flex items-center gap-4">
          <img src={inv.coverPhoto} alt="" className="h-24 w-20 rounded-xl object-cover shadow-sm" />
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => coverInput.current?.click()} className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white">
              {busy ? "처리 중…" : "사진 변경"}
            </button>
            <span className="text-[12px] text-muted">세로 사진을 추천해요</span>
          </div>
          <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={onCover} />
        </div>
      </Field>
      <Field label="예시 사진으로 바꾸기">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {SAMPLE_PHOTOS.map((s) => (
            <button key={s} type="button" onClick={() => update((d) => void (d.coverPhoto = s))} className={`shrink-0 overflow-hidden rounded-lg ring-2 ${inv.coverPhoto === s ? "ring-brand-400" : "ring-transparent"}`}>
              <img src={s} alt="" className="h-16 w-12 object-cover" />
            </button>
          ))}
        </div>
      </Field>
      <Field label={`갤러리 사진 (${inv.gallery.length}/30)`}>
        <div className="grid grid-cols-4 gap-2">
          {inv.gallery.map((src, i) => (
            <div key={src.slice(-24) + i} className="group relative aspect-square overflow-hidden rounded-lg">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-end justify-between bg-black/0 p-1 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                <button type="button" onClick={() => move(i, -1)} className="rounded bg-white/90 px-1.5 text-[11px]" aria-label="앞으로">◀</button>
                <button type="button" onClick={() => move(i, 1)} className="rounded bg-white/90 px-1.5 text-[11px]" aria-label="뒤로">▶</button>
              </div>
              <button type="button" onClick={() => update((d) => void d.gallery.splice(i, 1))} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] text-white" aria-label="사진 삭제">
                ✕
              </button>
            </div>
          ))}
          {inv.gallery.length < 30 && (
            <button type="button" onClick={() => galleryInput.current?.click()} className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-200 text-brand-400 hover:bg-brand-50">
              <span className="text-[22px] leading-none">＋</span>
              <span className="mt-1 text-[11px]">추가</span>
            </button>
          )}
        </div>
        <input ref={galleryInput} type="file" accept="image/*" multiple className="hidden" onChange={onGallery} />
      </Field>
    </>
  );
}

/* ─────────── 계좌 ─────────── */
function AccountsEditor({ inv, update }: { inv: Invitation; update: Updater }) {
  const sides: [Account["side"], string][] = inv.type === "wedding" ? [["groom", "신랑측"], ["bride", "신부측"]] : [["host", "초대하는 분"]];
  const edit = (id: string, fn: (a: Account) => void) =>
    update((d) => {
      const a = d.accounts.find((x) => x.id === id);
      if (a) fn(a);
    });
  return (
    <>
      {inv.accounts.map((a) => (
        <div key={a.id} className="space-y-3 rounded-xl bg-cream p-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-brand-600">{a.label || "계좌"}</p>
            <button type="button" onClick={() => update((d) => void (d.accounts = d.accounts.filter((x) => x.id !== a.id)))} className="text-[12px] text-muted underline">
              삭제
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {sides.length > 1 && <Select label="구분" value={a.side} onChange={(v) => edit(a.id, (x) => void (x.side = v as Account["side"]))} options={sides} />}
            <TextInput label="표시 이름" value={a.label} onChange={(v) => edit(a.id, (x) => void (x.label = v))} placeholder="신랑 아버지" />
            <Select label="은행" value={a.bank} onChange={(v) => edit(a.id, (x) => void (x.bank = v))} options={BANKS} />
            <TextInput label="예금주" value={a.holder} onChange={(v) => edit(a.id, (x) => void (x.holder = v))} />
            <TextInput label="계좌번호" value={a.number} onChange={(v) => edit(a.id, (x) => void (x.number = v))} className="col-span-2" placeholder="123-456-789012" />
            <TextInput label="카카오페이 송금 링크 (선택)" value={a.kakaoPayUrl} onChange={(v) => edit(a.id, (x) => void (x.kakaoPayUrl = v))} className="col-span-2" placeholder="https://qr.kakaopay.com/..." />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => update((d) => void d.accounts.push({ id: newId(), side: sides[0][0], label: "", bank: BANKS[0], number: "", holder: "" }))}
        className="w-full rounded-xl border-2 border-dashed border-brand-200 py-3 text-[14px] font-medium text-brand-500 hover:bg-brand-50"
      >
        ＋ 계좌 추가
      </button>
    </>
  );
}

/* ─────────── 편집기 본체 ─────────── */
export function Editor({ initial }: { initial: Invitation }) {
  const router = useRouter();
  const [inv, setInv] = useState<Invitation>(initial);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [designOpen, setDesignOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const theme = getTemplate(inv.templateId) as Theme;

  const toast = (m: string) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(null), 2000);
  };
  const update: Updater = (fn) =>
    setInv((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  const save = async () => {
    if (!/^[a-z0-9-]{3,30}$/.test(inv.slug)) {
      toast("청첩장 주소는 영문 소문자·숫자·- 로 3~30자여야 해요");
      return;
    }
    try {
      await saveInvitation(inv);
      setSaved(inv.slug);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const sameCategory = TEMPLATES.filter((t) => t.category === theme.category);

  return (
    <div className="min-h-dvh bg-[#FBF7F4]">
      {/* 상단 바 */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Logo className="hidden sm:flex" />
            <Link href={`/templates/${theme.id}`} className="rounded-full p-2 text-muted hover:bg-black/5 sm:hidden" aria-label="뒤로">
              ←
            </Link>
            <span className="hidden h-5 w-px bg-black/10 sm:block" />
            <button onClick={() => setDesignOpen(true)} className="flex items-center gap-2 rounded-full bg-cream px-3 py-1.5 text-[13px] font-medium">
              <span className="h-3 w-3 rounded-full" style={{ background: theme.palette.accent }} />
              {theme.name}
              <span className="text-muted">· 디자인 변경</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/i/sample-${theme.id}`} target="_blank" className="hidden rounded-full border border-black/10 px-4 py-2 text-[13px] font-medium md:block">
              예시 보기
            </Link>
            <button onClick={save} className="rounded-full bg-brand-500 px-5 py-2 text-[14px] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(242,95,125,0.7)] hover:bg-brand-600">
              저장하기
            </button>
          </div>
        </div>
        {/* 모바일 탭 */}
        <div className="flex border-t border-black/5 lg:hidden">
          {(["edit", "preview"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`flex-1 py-2.5 text-[14px] font-medium ${view === v ? "border-b-2 border-brand-500 text-brand-600" : "text-muted"}`}>
              {v === "edit" ? "✏️ 편집" : "📱 미리보기"}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 lg:grid-cols-[1fr_400px]">
        {/* 입력 영역 */}
        <div className={`space-y-3 ${view === "preview" ? "hidden lg:block" : ""}`}>
          <div className="rounded-2xl bg-gradient-to-r from-brand-100 to-peach p-5">
            <p className="text-[18px] font-bold">✨ 내용을 입력하면 오른쪽에 바로 보여요</p>
            <p className="mt-1 text-[13px] text-ink/60">예시 내용이 미리 채워져 있어요. 우리 정보로 바꿔주세요!</p>
          </div>

          <Panel title="청첩장 주소" emoji="🔗" defaultOpen>
            <Field label="주소" hint="영문 소문자, 숫자, - 만 사용할 수 있어요. 예) minjun-seoyeon">
              <div className="flex items-center overflow-hidden rounded-xl border border-black/10 bg-white focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-100">
                <span className="bg-cream px-3 py-2.5 text-[13px] text-muted">bomgyeol.kr/i/</span>
                <input className="w-full px-2 py-2.5 text-[14px] outline-none" value={inv.slug} onChange={(e) => update((d) => void (d.slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")))} />
              </div>
            </Field>
          </Panel>

          <Panel title={inv.type === "wedding" ? "신랑 · 신부 정보" : inv.type === "dol" ? "아기 정보" : "주인공 정보"} emoji={inv.type === "wedding" ? "💍" : inv.type === "dol" ? "👶" : "🌺"} defaultOpen>
            {inv.type === "wedding" && inv.wedding && (
              <>
                <PartnerFields who="신랑" p={inv.wedding.groom} onChange={(fn) => update((d) => fn(d.wedding!.groom))} />
                <PartnerFields who="신부" p={inv.wedding.bride} onChange={(fn) => update((d) => fn(d.wedding!.bride))} />
              </>
            )}
            {inv.type === "dol" && inv.dol && (
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="아기 이름" value={inv.dol.babyName} onChange={(v) => update((d) => void (d.dol!.babyName = v))} />
                <TextInput label="영문 이름" value={inv.dol.babyEnglishName} onChange={(v) => update((d) => void (d.dol!.babyEnglishName = v))} />
                <TextInput label="생일" type="date" value={inv.dol.birthDate} onChange={(v) => update((d) => void (d.dol!.birthDate = v))} />
                <TextInput label="연락처" type="tel" value={inv.dol.phone} onChange={(v) => update((d) => void (d.dol!.phone = v))} />
                <TextInput label="아빠 이름" value={inv.dol.father} onChange={(v) => update((d) => void (d.dol!.father = v))} />
                <TextInput label="엄마 이름" value={inv.dol.mother} onChange={(v) => update((d) => void (d.dol!.mother = v))} />
              </div>
            )}
            {inv.type === "party" && inv.party && (
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="주인공 성함" value={inv.party.honoreeName} onChange={(v) => update((d) => void (d.party!.honoreeName = v))} />
                <Select label="잔치 종류" value={inv.party.eventName} onChange={(v) => update((d) => void (d.party!.eventName = v))} options={["회갑", "진갑", "칠순", "고희", "팔순", "산수", "구순", "생신"]} />
                <TextInput label="초대하는 분" value={inv.party.hostName} onChange={(v) => update((d) => void (d.party!.hostName = v))} placeholder="자녀 일동" />
                <TextInput label="연락처" type="tel" value={inv.party.phone} onChange={(v) => update((d) => void (d.party!.phone = v))} />
              </div>
            )}
          </Panel>

          <Panel title="날짜 · 시간" emoji="📅">
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="날짜" type="date" value={inv.dateTime.slice(0, 10)} onChange={(v) => v && update((d) => void (d.dateTime = `${v}T${d.dateTime.slice(11, 16)}`))} />
              <TextInput label="시간" type="time" value={inv.dateTime.slice(11, 16)} onChange={(v) => v && update((d) => void (d.dateTime = `${d.dateTime.slice(0, 10)}T${v}`))} />
            </div>
          </Panel>

          <Panel title="장소 · 오시는 길" emoji="🗺️">
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="장소 이름" value={inv.venue.name} onChange={(v) => update((d) => void (d.venue.name = v))} />
              <TextInput label="층 · 홀" value={inv.venue.hall} onChange={(v) => update((d) => void (d.venue.hall = v))} />
            </div>
            <Field label="주소" hint="카카오 주소 검색은 백엔드 연결 후 자동으로 좌표까지 입력돼요.">
              <div className="flex gap-2">
                <input className={inputCls} value={inv.venue.address} onChange={(e) => update((d) => void (d.venue.address = e.target.value))} />
                <button type="button" onClick={() => toast("주소 검색은 카카오 API 연동 후 사용할 수 있어요")} className="shrink-0 rounded-xl bg-ink px-4 text-[13px] font-medium text-white">
                  검색
                </button>
              </div>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <TextInput label="전화번호" value={inv.venue.tel} onChange={(v) => update((d) => void (d.venue.tel = v))} />
              <TextInput label="위도" value={String(inv.venue.lat)} onChange={(v) => update((d) => void (d.venue.lat = Number(v) || 0))} />
              <TextInput label="경도" value={String(inv.venue.lng)} onChange={(v) => update((d) => void (d.venue.lng = Number(v) || 0))} />
            </div>
            <TextInput label="🚇 지하철" value={inv.venue.subway} onChange={(v) => update((d) => void (d.venue.subway = v))} />
            <TextInput label="🚌 버스" value={inv.venue.bus} onChange={(v) => update((d) => void (d.venue.bus = v))} />
            <TextInput label="🅿️ 주차" value={inv.venue.parking} onChange={(v) => update((d) => void (d.venue.parking = v))} />
            <TextInput label="🚗 자가용" value={inv.venue.car} onChange={(v) => update((d) => void (d.venue.car = v))} />
          </Panel>

          <Panel title="인사말" emoji="💌">
            <Field label="추천 문구">
              <div className="flex flex-wrap gap-2">
                {GREETING_PRESETS[inv.type].map((g) => (
                  <button key={g.title} type="button" onClick={() => update((d) => ((d.greetingTitle = g.title), (d.greeting = g.text)))} className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[12px] text-brand-600 hover:bg-brand-100">
                    {g.title}
                  </button>
                ))}
              </div>
            </Field>
            <TextInput label="제목" value={inv.greetingTitle} onChange={(v) => update((d) => void (d.greetingTitle = v))} />
            <TextArea label="내용" value={inv.greeting} onChange={(v) => update((d) => void (d.greeting = v))} rows={9} />
          </Panel>

          <Panel title="사진" emoji="🖼️" badge={`${inv.gallery.length}장`}>
            <PhotoPicker inv={inv} update={update} toast={toast} />
          </Panel>

          <Panel title="마음 전하실 곳 (계좌)" emoji="💳" badge={`${inv.accounts.length}개`}>
            <AccountsEditor inv={inv} update={update} />
          </Panel>

          <Panel title="표시할 기능" emoji="⚙️">
            <div className="divide-y divide-black/5">
              <Toggle label="달력" checked={inv.options.showCalendar} onChange={(v) => update((d) => void (d.options.showCalendar = v))} />
              <Toggle label="D-day 카운트다운" checked={inv.options.showDday} onChange={(v) => update((d) => void (d.options.showDday = v))} />
              <Toggle label="사진 갤러리" checked={inv.options.showGallery} onChange={(v) => update((d) => void (d.options.showGallery = v))} />
              <Toggle label="계좌번호" checked={inv.options.showAccounts} onChange={(v) => update((d) => void (d.options.showAccounts = v))} />
              <Toggle label="참석 의사 전달" desc="하객이 참석 인원과 식사 여부를 알려줘요" checked={inv.options.showRsvp} onChange={(v) => update((d) => void (d.options.showRsvp = v))} />
              <Toggle label="축하 방명록" checked={inv.options.showGuestbook} onChange={(v) => update((d) => void (d.options.showGuestbook = v))} />
              <Toggle label="움직이는 효과" desc="꽃잎·색종이·반짝이 (디자인마다 달라요)" checked={inv.options.showEffect} onChange={(v) => update((d) => void (d.options.showEffect = v))} />
            </div>
            <TextInput label="배경음악 주소 (mp3, 선택)" value={inv.options.bgmUrl} onChange={(v) => update((d) => void (d.options.bgmUrl = v || undefined))} placeholder="https://.../music.mp3" hint="음원 업로드는 백엔드 연결 후 지원 예정이에요." />
          </Panel>

          <Panel title="카카오톡 공유 설정" emoji="💬">
            <TextInput label="공유 제목" value={inv.shareTitle} onChange={(v) => update((d) => void (d.shareTitle = v))} />
            <TextInput label="공유 설명" value={inv.shareDescription} onChange={(v) => update((d) => void (d.shareDescription = v))} />
            <Field label="카카오톡 미리보기">
              <div className="w-64 overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                <img src={inv.coverPhoto} alt="" className="aspect-[4/3] w-full object-cover" />
                <div className="p-3">
                  <p className="text-[14px] font-semibold">{inv.shareTitle}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-muted">{inv.shareDescription}</p>
                </div>
                <div className="border-t border-black/5 py-2.5 text-center text-[13px]">청첩장 보기</div>
              </div>
            </Field>
          </Panel>
        </div>

        {/* 미리보기 */}
        <aside className={`${view === "edit" ? "hidden lg:block" : ""}`}>
          <div className="lg:sticky lg:top-24">
            <PhoneFrame className="max-w-[360px]">
              <InvitationView invitation={inv} theme={theme} mode="frame" readOnly />
            </PhoneFrame>
            <p className="mt-3 text-center text-[12px] text-muted">미리보기에서는 방명록·참석 의사가 저장되지 않아요</p>
          </div>
        </aside>
      </div>

      {/* 디자인 변경 */}
      {designOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setDesignOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-bold">디자인 변경</h3>
              <button onClick={() => setDesignOpen(false)} className="p-1 text-muted" aria-label="닫기">✕</button>
            </div>
            <p className="mt-1 text-[13px] text-muted">입력한 내용은 그대로 유지돼요</p>
            <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {sameCategory.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    update((d) => {
                      if (d.coverPhoto === theme.samplePhoto) d.coverPhoto = t.samplePhoto;
                      d.templateId = t.id;
                    });
                    setDesignOpen(false);
                  }}
                  className={`overflow-hidden rounded-2xl border-2 text-left transition ${t.id === theme.id ? "border-brand-500" : "border-transparent hover:border-brand-200"}`}
                >
                  <div className="flex h-24 items-center justify-center" style={{ background: t.palette.bg }}>
                    <span className="text-[22px]" style={{ fontFamily: t.fonts.script, color: t.palette.accent }}>
                      {t.nameEn.split(" ")[0]}
                    </span>
                  </div>
                  <p className="px-3 py-2 text-[13px] font-medium">{t.name}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 저장 완료 */}
      {saved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5" onClick={() => setSaved(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-[44px]">🎉</p>
            <p className="mt-2 text-[20px] font-bold">청첩장이 저장되었어요!</p>
            <p className="mt-2 text-[14px] text-muted">지금은 이 브라우저에만 저장돼요. (서버 연결 후 어디서나 볼 수 있어요)</p>
            <div className="mt-5 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink/70">/i/{saved}</div>
            <div className="mt-5 flex flex-col gap-2">
              <Link href={`/i/${saved}`} target="_blank" className="rounded-full bg-brand-500 py-3 text-[15px] font-semibold text-white">
                내 청첩장 보기
              </Link>
              <button onClick={() => router.push("/my")} className="rounded-full border border-black/10 py-3 text-[15px] font-medium">
                내 청첩장 목록
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-8 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-black/80 px-5 py-2.5 text-[14px] text-white shadow-lg animate-fade-up">{toastMsg}</div>
      )}
    </div>
  );
}

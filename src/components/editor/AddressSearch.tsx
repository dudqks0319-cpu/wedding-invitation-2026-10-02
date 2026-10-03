"use client";

import { useEffect, useId, useRef, useState } from "react";
import { selectedRoadAddress } from "@/lib/address";

type Postcode = new (options: { width: string; height: string; oncomplete(data: unknown): void; onresize(size: { height: number }): void }) => { embed(el: HTMLElement): void };
type PostcodeWindow = Window & { kakao?: { Postcode?: Postcode }; daum?: { Postcode?: Postcode } };
let pending: Promise<Postcode> | undefined;
function loadPostcode(): Promise<Postcode> {
  const read = () => (window as PostcodeWindow).kakao?.Postcode ?? (window as PostcodeWindow).daum?.Postcode;
  const ready = read();
  if (ready) return Promise.resolve(ready);
  pending ??= new Promise<Postcode>((resolve, reject) => {
    document.getElementById("invitation-postcode")?.remove();
    const script = document.createElement("script");
    script.id = "invitation-postcode";
    script.src = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    script.referrerPolicy = "origin";
    const fail = () => { clearTimeout(timeout); script.remove(); reject(new Error("주소 검색 연결 실패")); };
    const timeout = setTimeout(fail, 12000);
    script.onload = () => { clearTimeout(timeout); const sdk = read(); if (sdk) resolve(sdk); else fail(); };
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch(error => { pending = undefined; throw error; });
  return pending;
}

/** Adapted from Osamosam: bounded loading, retry, Escape and manual-entry fallback. */
export function AddressSearch({ onSelect }: { onSelect: (value: ReturnType<typeof selectedRoadAddress>) => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null), container = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const generation = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [status, setStatus] = useState("idle"), [message, setMessage] = useState("");
  useEffect(() => () => { generation.current++; clearTimeout(timer.current); }, []);
  function close() {
    generation.current++;
    clearTimeout(timer.current);
    dialog.current?.close(); container.current?.replaceChildren();
    setStatus("idle"); trigger.current?.focus();
  }
  async function open() {
    const version = ++generation.current;
    clearTimeout(timer.current); setStatus("loading"); setMessage("");
    if (!dialog.current?.open) dialog.current?.showModal();
    const mount = document.createElement("div"); mount.style.height = "100%";
    container.current?.replaceChildren(mount);
    const fail = () => {
      if (version !== generation.current) return;
      generation.current++; clearTimeout(timer.current); mount.remove(); setStatus("error");
      setMessage("주소 검색을 불러오지 못했어요. 다시 불러오거나 직접 입력해 주세요.");
    };
    timer.current = setTimeout(fail, 12000);
    try {
      const Postcode = await loadPostcode();
      if (version !== generation.current || !mount.isConnected) return;
      new Postcode({ width: "100%", height: "100%",
        onresize(size) { if (version === generation.current && size.height > 0) { clearTimeout(timer.current); setStatus("ready"); } },
        oncomplete(data) {
          if (version !== generation.current) return;
          try { const selected = selectedRoadAddress(data); onSelect(selected); close(); setMessage("주소를 입력했어요."); }
          catch (error) { setMessage((error as Error).message); }
        },
      }).embed(mount);
    } catch { fail(); }
  }
  const button = "min-h-11 rounded-xl border border-black/10 px-4 text-[13px] font-medium";
  return <div>
    <button ref={trigger} type="button" onClick={() => void open()} className={`${button} bg-ink text-white`}>도로명주소 검색</button>
    <p role="status" className="mt-2 text-[12px] text-muted">{message || "건물명·도로명·지번으로 찾을 수 있어요."}</p>
    <dialog ref={dialog} aria-labelledby={id} onCancel={e => { e.preventDefault(); close(); }} className="fixed m-auto w-[calc(100%_-_24px)] max-w-lg rounded-2xl bg-white p-4 shadow-xl backdrop:bg-black/40">
      <div className="flex items-center justify-between gap-2"><h2 id={id} className="font-bold">도로명주소 찾기</h2><button type="button" className={button} onClick={close}>닫기</button></div>
      <p role="status" className="my-3 text-sm">{status === "loading" ? "주소 검색을 불러오는 중…" : message}</p>
      <div ref={container} hidden={status === "error"} aria-busy={status === "loading"} className="h-[min(52dvh,450px)]" />
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={button} onClick={() => void open()}>다시 불러오기</button><button type="button" className={button} onClick={close}>닫고 직접 입력</button></div>
    </dialog>
  </div>;
}

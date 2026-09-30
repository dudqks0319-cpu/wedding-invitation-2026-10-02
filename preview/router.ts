import { useSyncExternalStore } from "react";

/**
 * 미리보기(단일 HTML) 전용 라우터.
 * 주소창 대신 메모리에 현재 화면을 기억하고, 브라우저 뒤로가기도 지원해요.
 */

type Loc = { pathname: string; search: string };

let loc: Loc = { pathname: "/", search: "" };
const listeners = new Set<() => void>();

function parse(href: string): Loc & { hash: string } {
  const [beforeHash, hash = ""] = href.split("#");
  const [pathname, search = ""] = beforeHash.split("?");
  return { pathname: pathname || loc.pathname, search, hash };
}

function scrollToHash(hash: string) {
  setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" }), 60);
}

export function navigate(href: string, { replace = false, scroll = true } = {}) {
  if (!href || href === "#") return;
  if (href.startsWith("#")) return scrollToHash(href.slice(1));
  if (/^(https?:|tel:|sms:|mailto:)/.test(href)) {
    window.open(href, "_blank", "noopener");
    return;
  }
  const next = parse(href);
  loc = { pathname: next.pathname, search: next.search };
  try {
    if (replace) history.replaceState({ href }, "");
    else history.pushState({ href }, "");
  } catch {
    /* 기록을 못 남겨도 화면 이동은 계속 */
  }
  listeners.forEach((l) => l());
  if (next.hash) scrollToHash(next.hash);
  else if (scroll) window.scrollTo(0, 0);
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", (e) => {
    const href = (e.state as { href?: string } | null)?.href ?? "/";
    const next = parse(href);
    loc = { pathname: next.pathname, search: next.search };
    listeners.forEach((l) => l());
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useLocation() {
  return useSyncExternalStore(subscribe, () => loc, () => loc);
}

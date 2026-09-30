import { useMemo } from "react";
import { navigate, useLocation } from "../router";

/** next/navigation 대신 쓰는 미리보기용 훅 */
export function useRouter() {
  return {
    push: (href: string, opts?: { scroll?: boolean }) => navigate(href, { scroll: opts?.scroll }),
    replace: (href: string, opts?: { scroll?: boolean }) => navigate(href, { replace: true, scroll: opts?.scroll ?? false }),
    back: () => history.back(),
    forward: () => history.forward(),
    refresh: () => {},
    prefetch: () => {},
  };
}

export function usePathname() {
  return useLocation().pathname;
}

export function useSearchParams() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function notFound(): never {
  throw new Error("NOT_FOUND");
}

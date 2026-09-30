import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { navigate } from "../router";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string };
  children?: ReactNode;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
};

/** next/link 대신 쓰는 미리보기용 링크 (새 창 대신 같은 화면에서 이동) */
export default function Link({ href, children, onClick, target: _target, prefetch: _p, replace, scroll, ...rest }: Props) {
  const h = typeof href === "string" ? href : (href.pathname ?? "/");
  return (
    <a
      href={h}
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        navigate(h, { replace, scroll });
      }}
    >
      {children}
    </a>
  );
}

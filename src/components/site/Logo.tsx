import Link from "next/link";
import { SITE } from "@/lib/site";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`} aria-label={`${SITE.name} 홈`}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx="16" cy="9" rx="5" ry="7.5" fill="#FB8199" opacity="0.9" transform={`rotate(${r} 16 16)`} />
        ))}
        <circle cx="16" cy="16" r="3.4" fill="#FFD98A" />
      </svg>
      <span className="font-serif text-[22px] font-bold tracking-tight text-ink">{SITE.name}</span>
    </Link>
  );
}

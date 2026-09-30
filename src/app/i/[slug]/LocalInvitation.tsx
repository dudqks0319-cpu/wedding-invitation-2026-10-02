"use client";

import Link from "next/link";
import { useInvitation } from "@/lib/api";
import { useHydrated } from "@/lib/useHydrated";
import { getTemplate } from "@/data/templates";
import { InvitationView } from "@/components/invitation/InvitationView";

export function LocalInvitation({ slug }: { slug: string }) {
  const hydrated = useHydrated();
  const inv = useInvitation(slug);
  const theme = inv && getTemplate(inv.templateId);

  if (!hydrated) return <div className="min-h-dvh bg-cream" />;
  if (!inv || !theme) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
        <p className="text-[48px]">💌</p>
        <p className="text-[18px] font-semibold">청첩장을 찾을 수 없어요</p>
        <p className="text-[14px] text-muted">주소가 정확한지 확인해 주세요.</p>
        <Link href="/" className="mt-4 rounded-full bg-brand-500 px-6 py-3 text-[14px] font-semibold text-white">
          홈으로 가기
        </Link>
      </div>
    );
  }
  return <InvitationView invitation={inv} theme={theme} />;
}

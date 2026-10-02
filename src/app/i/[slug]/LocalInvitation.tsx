"use client";

import Link from "next/link";
import { useApiState, useInvitation } from "@/lib/api";
import { useHydrated } from "@/lib/useHydrated";
import { getTemplate } from "@/data/templates";
import { InvitationView } from "@/components/invitation/InvitationView";

export function LocalInvitation({ slug }: { slug: string }) {
  const hydrated = useHydrated();
  const inv = useInvitation(slug);
  const status = useApiState(`/api/invitations/${slug}`);
  const theme = inv && getTemplate(inv.templateId);

  if (!hydrated || status.loading) return <div className="min-h-dvh bg-cream p-8 text-center">청첩장을 불러오는 중…</div>;
  if (!inv || !theme) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
        <p className="text-[48px]">💌</p>
        <p className="text-[18px] font-semibold">청첩장을 찾을 수 없어요</p>
        <p className="text-[14px] text-muted">{status.error?.message ?? '주소가 정확한지 확인해 주세요.'}</p>
        <Link href="/" className="mt-4 rounded-full bg-brand-500 px-6 py-3 text-[14px] font-semibold text-white">
          홈으로 가기
        </Link>
      </div>
    );
  }
  return <>{inv.ownerView && inv.published && <p className="bg-cream p-3 text-center text-[13px]">작성자 미리보기 · 수정 내용은 공유 내용 업데이트를 누르면 반영돼요</p>}{inv.published === false && <p className="bg-cream p-3 text-center text-[13px]">내 초안 · 공유를 시작하면 하객이 볼 수 있어요</p>}<InvitationView invitation={inv} theme={theme} readOnly={inv.published === false} /></>;
}

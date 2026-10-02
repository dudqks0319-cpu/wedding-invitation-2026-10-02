"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createSample } from "@/data/samples";
import { getTemplate } from "@/data/templates";
import { newId, useApiState, useInvitation } from "@/lib/api";
import { readStored,writeStored } from "@/lib/localStore";
import { REMOTE_DATA } from "@/lib/dataMode";
import type { Invitation } from "@/types/invitation";
import { useHydrated } from "@/lib/useHydrated";
import { Editor } from "@/components/editor/Editor";

function Inner({ templateId }: { templateId: string }) {
  const params = useSearchParams();
  const editSlug = params.get("edit");
  const existing = useInvitation(editSlug ?? '');
  const status = useApiState(editSlug ? `/api/invitations/${editSlug}` : '');
  const session = useApiState('/api/auth/session');
  const owner = (session.data as {id?:string}|undefined)?.id ?? 'guest';
  if (REMOTE_DATA && session.loading) return <p className="p-8">편집기를 준비하고 있어요…</p>;
  if (REMOTE_DATA && editSlug && status.loading) return <p className="p-8">청첩장을 불러오는 중…</p>;
  if (editSlug && !existing) return <p className="p-8">{status.error?.message ?? '청첩장을 찾을 수 없어요'}</p>;
  return <Ready templateId={templateId} existing={existing} owner={owner} key={owner+':'+(editSlug ?? templateId)} />;
}
function Ready({templateId, existing,owner}: {templateId: string; existing?: Invitation;owner:string}) {
  const draftKey=existing ? `editor-v2:${owner}:edit:${existing.slug}` : `editor-v2:${owner}:new:${templateId}`;
  const [initial] = useState(() => {
    if (existing) return readStored<Invitation | null>(draftKey, null) ?? existing;
    const draft = readStored<Invitation | null>(draftKey, null);
    if (draft) return draft;
    if(owner!=='guest'){
      const guestKey=`editor-v2:guest:new:${templateId}`,guest=readStored<Invitation|null>(guestKey,null);
      if(guest){writeStored(draftKey,guest);writeStored(guestKey,null);return guest;}
    }
    const sample = createSample(getTemplate(templateId)!);
    return { ...sample, slug: `my-${newId()}` };
  });
  return <Editor initial={initial} draftKey={draftKey} existing={!!existing} />;
}

export function EditorLoader({ templateId }: { templateId: string }) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#FBF7F4] text-muted">
        <span className="animate-pulse">편집기를 준비하고 있어요…</span>
      </div>
    );
  }
  return (
    <Suspense>
      <Inner templateId={templateId} />
    </Suspense>
  );
}

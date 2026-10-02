"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createSample } from "@/data/samples";
import { getTemplate } from "@/data/templates";
import { newId, useApiState, useInvitation } from "@/lib/api";
import { readStored } from "@/lib/localStore";
import { REMOTE_DATA } from "@/lib/dataMode";
import type { Invitation } from "@/types/invitation";
import { useHydrated } from "@/lib/useHydrated";
import { Editor } from "@/components/editor/Editor";

function Inner({ templateId }: { templateId: string }) {
  const params = useSearchParams();
  const editSlug = params.get("edit");
  const existing = useInvitation(editSlug ?? '');
  const status = useApiState(editSlug ? `/api/invitations/${editSlug}` : '');
  if (REMOTE_DATA && editSlug && status.loading) return <p className="p-8">청첩장을 불러오는 중…</p>;
  if (editSlug && !existing) return <p className="p-8">{status.error?.message ?? '청첩장을 찾을 수 없어요'}</p>;
  return <Ready templateId={templateId} existing={existing} key={editSlug ?? templateId} />;
}
function Ready({templateId, existing}: {templateId: string; existing?: Invitation}) {
  const [initial] = useState(() => {
    if (existing) return existing;
    const draft = readStored<Invitation | null>(`editor-draft:${templateId}`, null);
    if (draft) return draft;
    const sample = createSample(getTemplate(templateId)!);
    return { ...sample, slug: `my-${newId()}` };
  });
  return <Editor initial={initial} />;
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

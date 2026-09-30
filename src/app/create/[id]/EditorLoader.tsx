"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createSample } from "@/data/samples";
import { getTemplate } from "@/data/templates";
import { getInvitation, newId } from "@/lib/api";
import { useHydrated } from "@/lib/useHydrated";
import { Editor } from "@/components/editor/Editor";

function Inner({ templateId }: { templateId: string }) {
  const params = useSearchParams();
  const editSlug = params.get("edit");
  const [initial] = useState(() => {
    // ?edit=주소 로 들어오면 저장된 청첩장을 불러와 이어서 편집
    const existing = editSlug ? getInvitation(editSlug) : undefined;
    if (existing) return existing;
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

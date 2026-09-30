import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TEMPLATES, getTemplate } from "@/data/templates";
import { EditorLoader } from "./EditorLoader";

export const metadata: Metadata = { title: "청첩장 만들기" };

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ id: t.id }));
}

export default async function CreatePage({ params }: PageProps<"/create/[id]">) {
  const { id } = await params;
  if (!getTemplate(id)) notFound();
  return <EditorLoader templateId={id} />;
}

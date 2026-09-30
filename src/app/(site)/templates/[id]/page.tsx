import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TEMPLATES, getTemplate } from "@/data/templates";
import { TemplateDetailView } from "./TemplateDetailView";

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ id: t.id }));
}

export async function generateMetadata({ params }: PageProps<"/templates/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = getTemplate(id);
  return { title: t ? `${t.name} 디자인` : "디자인" };
}

export default async function TemplateDetail({ params }: PageProps<"/templates/[id]">) {
  const { id } = await params;
  if (!getTemplate(id)) notFound();
  return <TemplateDetailView id={id} />;
}

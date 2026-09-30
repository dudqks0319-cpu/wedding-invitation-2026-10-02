import type { Metadata } from "next";
import { TemplateBrowser } from "./TemplateBrowser";
import type { EventType } from "@/types/invitation";

export const metadata: Metadata = { title: "디자인 고르기" };

export default async function TemplatesPage({ searchParams }: PageProps<"/templates">) {
  const { type } = await searchParams;
  const initial: EventType | "all" = type === "wedding" || type === "dol" || type === "party" ? type : "all";
  return <TemplateBrowser key={initial} initialType={initial} />;
}

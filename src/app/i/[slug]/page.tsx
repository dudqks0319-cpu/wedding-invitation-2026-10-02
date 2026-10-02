import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import { getSampleBySlug, SAMPLE_SLUGS } from "@/data/samples";
import { getTemplate } from "@/data/templates";
import { InvitationView } from "@/components/invitation/InvitationView";
import { REMOTE_DATA } from "@/lib/dataMode";
import { publicInvitation } from "@/lib/server/invitations";
import { limits } from "@/lib/server/security";
import { InvitationRoute } from "./InvitationRoute";

const published = cache(async (slug: string) => {
  await limits(new Request(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost', {headers: await headers()}), 'page-read');
  return publicInvitation(slug);
});
export function generateStaticParams() { return SAMPLE_SLUGS.map((slug) => ({ slug })); }
export async function generateMetadata({ params }: PageProps<"/i/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const sample = getSampleBySlug(slug);
  const inv = sample ?? (REMOTE_DATA ? await published(slug) : null);
  if (!inv) return { title: "모바일 청첩장", robots: {index:false,follow:false} };
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return {
    title: inv.shareTitle, description: inv.shareDescription,
    robots: {index:false,follow:false},
    openGraph: { title: inv.shareTitle, description: inv.shareDescription, url: new URL(`/i/${slug}`, base), images: [{url: new URL(inv.coverPhoto, base).toString()}] },
  };
}
export default async function InvitationPage({ params }: PageProps<"/i/[slug]">) {
  const { slug } = await params;
  if (!getSampleBySlug(slug) && REMOTE_DATA) {
    const inv = await published(slug);
    if (inv) return <InvitationView invitation={inv} theme={getTemplate(inv.templateId)!} />;
  }
  return <InvitationRoute slug={slug} />;
}

import type { Metadata } from "next";
import { getSampleBySlug, SAMPLE_SLUGS } from "@/data/samples";
import { InvitationRoute } from "./InvitationRoute";

/**
 * 하객이 보는 실제 청첩장 페이지
 * - /i/sample-xxx : 템플릿 예시
 * - 그 외 주소     : (지금은) 이 브라우저에 저장된 청첩장 → 백엔드 연결 시 서버에서 불러오기
 */

export function generateStaticParams() {
  return SAMPLE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/i/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const inv = getSampleBySlug(slug);
  // TODO(backend): 저장된 청첩장도 서버에서 불러와 카카오톡 미리보기(og:image)를 채우기
  if (!inv) return { title: "모바일 청첩장" };
  return {
    title: inv.shareTitle,
    description: inv.shareDescription,
    openGraph: { title: inv.shareTitle, description: inv.shareDescription, images: [inv.coverPhoto] },
  };
}

export default async function InvitationPage({ params }: PageProps<"/i/[slug]">) {
  const { slug } = await params;
  return <InvitationRoute slug={slug} />;
}

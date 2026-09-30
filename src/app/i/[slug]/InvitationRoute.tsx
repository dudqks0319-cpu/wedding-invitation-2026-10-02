import { getSampleBySlug } from "@/data/samples";
import { getTemplate } from "@/data/templates";
import { InvitationView } from "@/components/invitation/InvitationView";
import { LocalInvitation } from "./LocalInvitation";

/** 예시 청첩장이면 바로 그리고, 아니면 저장된 청첩장을 불러와요 */
export function InvitationRoute({ slug }: { slug: string }) {
  const sample = getSampleBySlug(slug);
  if (sample) return <InvitationView invitation={sample} theme={getTemplate(sample.templateId)!} />;
  return <LocalInvitation slug={slug} />;
}

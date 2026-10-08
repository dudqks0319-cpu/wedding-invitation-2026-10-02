import "pretendard/dist/web/variable/pretendardvariable.css";
import "./preview.css";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import type { EventType } from "@/types/invitation";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import Home from "@/app/(site)/page";
import { TemplateBrowser } from "@/app/(site)/templates/TemplateBrowser";
import { TemplateDetailView } from "@/app/(site)/templates/[id]/TemplateDetailView";
import PricingPage from "@/app/(site)/pricing/page";
import MyPage from "@/app/(site)/my/page";
import LoginPage from "@/app/(site)/login/page";
import PrivacyPage from "@/app/(site)/privacy/page";
import TermsPage from "@/app/(site)/terms/page";
import SettingsPage from "@/app/(site)/settings/page";
import SupportPage from "@/app/(site)/support/page";
import OperationsPage from "@/app/(site)/operations/page";
import { EditorLoader } from "@/app/create/[id]/EditorLoader";
import { InvitationRoute } from "@/app/i/[slug]/InvitationRoute";
import NotFound from "@/app/not-found";
import { navigate, useLocation } from "./router";
import { registerTemplateTool } from "./webmcp";
import { REMOTE_DATA } from "@/lib/dataMode";
import {SessionBoundary} from './SessionBoundary';

function BackToSite() {
  return (
    <nav aria-label="청첩장 탐색" className="bg-cream px-4 py-2">
    <button
      onClick={() => navigate("/templates")}
      className="min-h-11 rounded-full bg-ink/85 px-4 py-2.5 text-[13px] font-semibold text-white"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      ← 디자인 목록
    </button>
    </nav>
  );
}

function App() {
  useEffect(registerTemplateTool, []);
  const { pathname, search } = useLocation();
  const [first, second] = pathname.split("/").filter(Boolean);

  if (first === "create" && second) return <EditorLoader key={pathname + search} templateId={second} />;
  if (first === "i" && second)
    return (
      <>
        <BackToSite />
        <InvitationRoute key={second} slug={second} />
      </>
    );

  let page;
  if (!first) page = <Home />;
  else if (first === "templates" && second) page = <TemplateDetailView key={second} id={second} />;
  else if (first === "templates") {
    const t = new URLSearchParams(search).get("type");
    const initial: EventType | "all" = t === "wedding" || t === "dol" || t === "party" ? t : "all";
    page = <TemplateBrowser key={initial} initialType={initial} />;
  } else if (first === "pricing") page = <PricingPage />;
  else if (first === "my") page = <MyPage />;
  else if (first === "login") page = <LoginPage />;
  else if (first === "privacy") page = <PrivacyPage />;
  else if (first === "terms") page = <TermsPage />;
  else if (first === "settings") page = <SettingsPage />;
  else if (first === "support") page = <SupportPage />;
  else if (first === "operations") page = <OperationsPage />;
  else return <NotFound />;

  return (
    <>
      <Header />
      <main>{page}</main>
      <Footer />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {!REMOTE_DATA && <div role="note" className="bg-brand-50 px-4 py-2 text-center text-[14px] text-brand-600">미리보기 · 내용은 이 브라우저에만 저장됩니다</div>}
    {REMOTE_DATA?<SessionBoundary><App /></SessionBoundary>:<App />}
  </StrictMode>,
);

import "pretendard/dist/web/variable/pretendardvariable.css";
import "./preview.css";
import { StrictMode } from "react";
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
import { EditorLoader } from "@/app/create/[id]/EditorLoader";
import { InvitationRoute } from "@/app/i/[slug]/InvitationRoute";
import NotFound from "@/app/not-found";
import { navigate, useLocation } from "./router";

function BackToSite() {
  return (
    <button
      onClick={() => navigate("/templates")}
      className="fixed bottom-5 left-5 z-[70] rounded-full bg-ink/85 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg backdrop-blur"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      ← 디자인 목록
    </button>
  );
}

function App() {
  const { pathname, search } = useLocation();
  const [first, second] = pathname.split("/").filter(Boolean);

  if (first === "create" && second) return <EditorLoader key={pathname + search} templateId={second} />;
  if (first === "i" && second)
    return (
      <>
        <InvitationRoute key={second} slug={second} />
        <BackToSite />
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
    <App />
  </StrictMode>,
);

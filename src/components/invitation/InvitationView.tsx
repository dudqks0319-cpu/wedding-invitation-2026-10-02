"use client";

import type { CSSProperties } from "react";
import type { Invitation, Theme } from "@/types/invitation";
import { Cover } from "./Covers";
import { EffectLayer } from "./EffectLayer";
import { MusicButton } from "./MusicButton";
import {
  AccountSection,
  DateSection,
  EndingSection,
  GallerySection,
  GreetingSection,
  GuestbookSection,
  LocationSection,
  RsvpSection,
} from "./Sections";
import { InvitationProvider, type ViewMode } from "./shared";
import { SITE } from "@/lib/site";

/** 테마 색/글꼴을 CSS 변수로 변환 */
export function themeVars(theme: Theme): CSSProperties {
  const p = theme.palette;
  return {
    "--inv-bg": p.bg,
    "--inv-surface": p.surface,
    "--inv-text": p.text,
    "--inv-subtext": p.subtext,
    "--inv-accent": p.accent,
    "--inv-accent-soft": p.accentSoft,
    "--inv-line": p.line,
    "--inv-surface-tint": `color-mix(in srgb, ${p.accentSoft} 45%, ${p.bg})`,
    "--inv-title": theme.fonts.title,
    "--inv-body": theme.fonts.body,
    "--inv-script": theme.fonts.script,
  } as CSSProperties;
}

interface Props {
  invitation: Invitation;
  theme: Theme;
  /** page: 실제 청첩장 화면 / frame: 휴대폰 모양 미리보기 안 */
  mode?: ViewMode;
  readOnly?: boolean;
}

export function InvitationView({ invitation: inv, theme, mode = "page", readOnly = false }: Props) {
  const o = inv.options;
  const body = (
    <>
      <Cover />
      <GreetingSection />
      <DateSection />
      {o.showGallery && <GallerySection />}
      <LocationSection />
      {o.showAccounts && <AccountSection />}
      {o.showRsvp && <RsvpSection />}
      {o.showGuestbook && <GuestbookSection />}
      <EndingSection />
      <footer className="pb-10 text-center text-[11px] tracking-[0.2em] opacity-50" style={{ fontFamily: "var(--font-sans)" }}>
        MADE WITH {SITE.nameEn}
      </footer>
    </>
  );

  const vars = themeVars(theme);
  const bgPattern = theme.pattern ? { backgroundImage: theme.pattern, backgroundSize: "40px 40px" } : {};

  if (mode === "frame") {
    return (
      <InvitationProvider value={{ inv, theme, mode, readOnly }}>
        <div className="inv relative h-full w-full overflow-hidden" style={vars}>
          <div className="thin-scrollbar h-full overflow-y-auto overflow-x-hidden [container-type:size]" style={{ ...bgPattern, backgroundColor: "var(--inv-bg)" }}>
            <div style={{ "--cover-h": "100cqh" } as CSSProperties}>{body}</div>
          </div>
          {o.showEffect && <EffectLayer effect={theme.effect} mode="frame" />}
          <MusicButton />
        </div>
      </InvitationProvider>
    );
  }

  return (
    <InvitationProvider value={{ inv, theme, mode, readOnly }}>
      <div className="inv min-h-dvh" style={{ ...vars, background: `color-mix(in srgb, ${theme.palette.accentSoft} 60%, #fff)` }}>
        <main
          className="relative mx-auto max-w-[480px] overflow-x-hidden shadow-[0_0_60px_rgba(0,0,0,0.06)]"
          style={{ ...bgPattern, backgroundColor: "var(--inv-bg)", "--cover-h": "min(100svh, 880px)" } as CSSProperties}
        >
          {body}
        </main>
        {o.showEffect && <EffectLayer effect={theme.effect} mode="page" />}
        <MusicButton />
      </div>
    </InvitationProvider>
  );
}

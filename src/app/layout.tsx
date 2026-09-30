import type { Metadata, Viewport } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { SITE } from "@/lib/site";

const GOOGLE_FONTS =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Gowun+Batang:wght@400;700",
    "family=Gowun+Dodum",
    "family=Nanum+Myeongjo:wght@400;700;800",
    "family=Noto+Serif+KR:wght@300;500;700",
    "family=Song+Myung",
    "family=Hahmlet:wght@300;500;700",
    "family=Gaegu:wght@400;700",
    "family=Nanum+Pen+Script",
    "family=Jua",
    "family=Great+Vibes",
    "family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400",
    "family=Playfair+Display:ital,wght@0,500;0,700;1,500",
    "family=Dancing+Script:wght@500;700",
    "family=Fredoka:wght@500;600",
  ].join("&") +
  "&display=swap";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: `${SITE.name} · 모바일 청첩장`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fffbf7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={GOOGLE_FONTS} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

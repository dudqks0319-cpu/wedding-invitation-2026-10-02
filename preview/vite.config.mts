/**
 * 설치 없이 열어볼 수 있는 "한 파일짜리 미리보기" 빌드
 *   npm run build:preview  →  dist-preview/index.html
 * Next.js 전용 기능(next/link, next/navigation)은 shims 폴더의 가짜 버전으로 바꿔 끼워요.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(root, "../src");

/** "/samples/xxx.svg" 경로를 그림 데이터로 바꿔 한 파일 안에 담기 */
function inlineSamples(): Plugin {
  return {
    name: "inline-samples",
    enforce: "pre",
    transform(code, id) {
      if (!id.startsWith(src) || !/\.tsx?$/.test(id.split("?")[0])) return;
      return code.replace(/(["'])\/samples\/([\w-]+\.svg)\1/g, (_m, _q, file: string) => {
        const data = readFileSync(path.resolve(root, "../public/samples", file)).toString("base64");
        return JSON.stringify(`data:image/svg+xml;base64,${data}`);
      });
    },
  };
}

export default defineConfig({
  root,
  base: "./",
  plugins: [inlineSamples(), react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: path.resolve(root, "shims/link.tsx") },
      { find: /^next\/navigation$/, replacement: path.resolve(root, "shims/navigation.ts") },
      { find: /^@\//, replacement: `${src}/` },
    ],
  },
  define: {
    "process.env.NEXT_PUBLIC_KAKAO_MAP_KEY": '""',
    "process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID": '""',
    "process.env.NEXT_PUBLIC_SITE_URL": '""',
  },
  build: {
    outDir: path.resolve(root, "../dist-preview"),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
  },
});

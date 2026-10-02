#!/usr/bin/env node
/**
 * 예시 사진 만들기 (OpenAI 이미지 API)
 *
 *   OPENAI_API_KEY=... npm run photos          # 없는 사진만 새로 만들기
 *   npm run photos -- --only wedding-blossom    # 특정 사진만
 *   npm run photos -- --force                   # 이미 있어도 다시 만들기
 *   npm run photos -- --manifest                # 사진은 만들지 않고 목록 파일만 갱신
 *
 * 결과: public/photos/<key>.webp + src/data/photos.generated.ts (화면이 자동으로 이 사진을 사용)
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 회사/클라우드 프록시 환경이면 Node 의 fetch 도 프록시를 쓰도록 다시 실행
if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: "inherit",
    env: { ...process.env, NODE_USE_ENV_PROXY: "1" },
  });
  process.exit(r.status ?? 1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public/photos");
const manifestFile = path.join(root, "src/data/photos.generated.ts");
const brief = JSON.parse(readFileSync(path.join(root, "scripts/photo-brief.json"), "utf8"));
const args = process.argv.slice(2);
const force = args.includes("--force");
const manifestOnly = args.includes("--manifest");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1]?.split(",") : null;
const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

function writeManifest() {
  const keys = new Set(brief.photos.map((p) => p.key));
  const files = readdirSync(outDir).filter((f) => /\.(webp|jpe?g|png)$/i.test(f));
  const entries = files
    .map((f) => [f.replace(/\.[^.]+$/, ""), `/photos/${f}`])
    .filter(([k]) => keys.has(k))
    .sort(([a], [b]) => a.localeCompare(b));
  const body = entries.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");
  writeFileSync(
    manifestFile,
    `// 자동 생성 파일: scripts/generate-photos.mjs 가 public/photos 안의 사진 목록으로 만들어요.\n` +
      `// 직접 사진을 넣었다면 \`npm run photos -- --manifest\` 로 갱신하세요.\n` +
      `export const GENERATED_PHOTOS: Partial<Record<string, string>> = {\n${body}${body ? "\n" : ""}};\n`,
  );
  console.log(`📒 사진 목록 갱신: ${entries.length}/${keys.size}장`);
}

async function generate(p) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      prompt: `${p.prompt}. ${brief.style}`,
      size: p.size,
      quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
      output_format: "webp",
      output_compression: 82,
      n: 1,
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("응답에 이미지가 없어요");
  writeFileSync(path.join(outDir, `${p.key}.webp`), Buffer.from(b64, "base64"));
}

if (!manifestOnly) {
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY 환경 변수가 필요해요.");
    process.exit(1);
  }
  const todo = brief.photos.filter(
    (p) => (!only || only.includes(p.key)) && (force || !existsSync(path.join(outDir, `${p.key}.webp`))),
  );
  console.log(`🎨 ${todo.length}장 생성 시작 (모델: ${model})`);
  let failed = 0;
  for (const p of todo) {
    process.stdout.write(`  · ${p.key} (${p.use}) … `);
    try {
      await generate(p);
      console.log("완료");
    } catch (e) {
      failed++;
      console.log(`실패: ${e.message.slice(0, 200)}`);
    }
  }
  if (failed) console.log(`⚠️  ${failed}장 실패 — 다시 실행하면 실패한 것만 이어서 만들어요.`);
}
writeManifest();

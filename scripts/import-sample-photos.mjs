import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const entries = JSON.parse(await readFile(new URL('../docs/evidence/photo-generation.json', import.meta.url), 'utf8'));
for (const entry of entries) {
  const output = new URL(`../public/photos/${entry.key}.webp`, import.meta.url);
  const buffer = await sharp(entry.path).rotate().resize({ width: 1200, height: 1536, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  if (buffer.length > 400 * 1024) throw new Error(`${entry.key}: 사진이 400KB를 넘어요`);
  await writeFile(output, buffer);
  console.log(`${entry.key}: ${Math.round(buffer.length / 1024)}KB`);
}

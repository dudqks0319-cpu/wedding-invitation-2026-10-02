// Generate only synthetic test data through the actual production serializer.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, 'src/lib/rsvpCsv.ts');
const bundle = await build({ configFile: false, logLevel: 'error', build: {
  write: false, minify: false, lib: { entry: source, formats: ['es'] },
} });
const chunk = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(item => item.type === 'chunk' && item.isEntry);
const { rsvpsToCsv } = await import('data:text/javascript;base64,' + Buffer.from(chunk.code).toString('base64'));
const entries = Array.from({ length: 500 }, (_, index) => ({
  id: `synthetic-private-id-${index}`,
  name: index === 0 ? '가상, "하객"' : `가상 하객 ${index}`,
  side: index % 2 ? 'bride' : 'groom',
  attending: index % 3 !== 1,
  count: 2,
  meal: index % 2 ? 'no' : 'yes',
  memo: index === 0 ? '첫 줄, "인용"\r\n다음 줄' : index === 499 ? '=1+1' : '합성 검수 자료',
  createdAt: '2026-10-03T23:30:00Z',
}));
const csv = rsvpsToCsv(entries);
assert.ok(csv.startsWith('\uFEFF'));
assert.ok(csv.includes('문자: =1+1'));
assert.ok(csv.includes('가상 하객 499'));
assert.ok(!csv.includes('synthetic-private-id'));
const output = path.join(root, 'ios/RuntimeTests/Fixtures/rsvp-native-export.json');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({
  synthetic: true,
  sourceSha256: createHash('sha256').update(await readFile(source)).digest('hex'),
  csvSha256: createHash('sha256').update(csv).digest('hex'),
  entryCount: entries.length,
  csv,
}, null, 2) + '\n');
console.log(JSON.stringify({ file: path.relative(root, output), entries: entries.length, bytes: Buffer.byteLength(csv) }));

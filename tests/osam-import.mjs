import assert from 'node:assert/strict';
import { build } from 'vite';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const result = await build({ configFile: false, logLevel: 'error', resolve: { alias: { '@': path.join(root, 'src') } }, build: { write: false, minify: false, lib: { entry: path.join(root, 'tests/osam-import.entry.ts'), formats: ['es'] } } });
const chunk = (Array.isArray(result) ? result[0] : result).output.find(v => v.type === 'chunk' && v.isEntry);
const h = await import('data:text/javascript;base64,' + Buffer.from(chunk.code).toString('base64'));
const checks = [];
const check = (name, fn) => { fn(); checks.push({ name, result: 'PASS' }); console.log('PASS', name); };
const sample = { ...h.createSample(h.TEMPLATES[0]), slug: 'calendar-test' };
check('older drafts still validate without new presentation fields', () => assert.equal(h.invitationValue(sample, h.TEMPLATES).options.font, undefined));
check('presentation and known font survive server whitelist', () => {
  const p = { x: 0.23, y: 0.8, zoom: 1.5, fit: 'contain' };
  const inv = h.invitationValue({ ...sample, coverPresentation: p, options: { ...sample.options, font: 'pretendard' } }, h.TEMPLATES);
  assert.deepEqual(inv.coverPresentation, p); assert.equal(inv.options.font, 'pretendard');
});
check('server rejects unknown CSS and invalid crop values', () => {
  for (const p of [{ x: -1 }, { y: 2 }, { zoom: 100 }, { zoom: NaN }, { x: Infinity }, { fit: 'url(javascript:alert(1))' }]) assert.throws(() => h.invitationValue({ ...sample, coverPresentation: { x: .5, y: .5, zoom: 1, fit: 'cover', ...p } }, h.TEMPLATES));
  assert.throws(() => h.invitationValue({ ...sample, options: { ...sample.options, font: 'url(https://tracking.invalid)' } }, h.TEMPLATES));
});
check('calendar uses Korea time regardless of host timezone and a stable UID', () => {
  const inv = { ...sample, dateTime: '2026-11-07T12:30' };
  const file = h.invitationCalendarFile(inv, new Date('2026-10-03T00:00:00Z'));
  assert.match(file, /DTSTART:20261107T033000Z/); assert.match(file, /DTSTAMP:20261003T000000Z/); assert.match(file, /UID:calendar-test@invitation/); assert(!file.includes('DTEND'));
});
check('calendar rejects impossible dates', () => {
  for (const dateTime of ['2026-02-30T12:00', '2026-10-03T25:00', 'bad', '2026-10-03T12:00\r\nBEGIN:VEVENT']) assert.equal(h.invitationCalendarFile({ ...sample, dateTime }), null);
});
check('calendar escapes injection, folds Korean text and excludes private data', () => {
  const inv = structuredClone(sample);
  inv.venue.name = '장소,;\nBEGIN:VEVENT'; inv.venue.address = '한글'.repeat(120); inv.venue.tel = 'SECRET-PHONE';
  inv.wedding.groom.phone = 'SECRET-PARTNER'; inv.accounts = [{ number: 'SECRET-BANK' }];
  const file = h.invitationCalendarFile(inv);
  assert.equal(file.split('\r\n').filter(l => l === 'BEGIN:VEVENT').length, 1);
  assert.match(file.replace(/\r\n /g, ''), /LOCATION:장소\\,\\;\\nBEGIN:VEVENT/);
  assert(file.split('\r\n').every(l => Buffer.byteLength(l, 'utf8') <= 75));
  assert(!/SECRET-/.test(file));
});
check('address chooses road then lot and rejects malformed SDK output', () => {
  assert.equal(h.selectedRoadAddress({ roadAddress: '도로명', jibunAddress: '지번', buildingName: '홀' }).address, '도로명');
  assert.equal(h.selectedRoadAddress({ jibunAddress: '지번' }).kind, 'lot');
  for (const value of [null, [], {}, { roadAddress: 1 }, { roadAddress: '가'.repeat(201) }, { roadAddress: '위조\n주소' }]) assert.throws(() => h.selectedRoadAddress(value));
});
check('unset coordinates search current address instead of old sample location', () => {
  const venue = { ...sample.venue, address: '새 도로명주소', lat: 0, lng: 0 };
  assert.equal(h.hasCoordinates(venue), false); assert.equal(h.kakaoMapUrl(venue), 'https://map.kakao.com/link/search/' + encodeURIComponent(venue.address));
  assert.equal(h.hasCoordinates({ ...venue, lat: NaN, lng: 127 }), false);
  assert.match(h.kakaoMapUrl({ ...venue, lat: 37.5, lng: 127 }), /,37.5,127$/);
});
check('design search combines words, category, tags and favorites', () => {
  const theme = h.TEMPLATES[0];
  assert(h.searchDesigns(h.TEMPLATES, { type: theme.category, tag: theme.tags[0], query: theme.nameEn.toUpperCase(), favorites: [theme.id] }).some(t => t.id === theme.id));
  assert.equal(h.searchDesigns(h.TEMPLATES, { type: 'all', tag: null, query: '존재하지않는디자인' }).length, 0);
  assert.deepEqual(h.favoriteDesigns([theme.id, theme.id, 'unknown', {}, null], h.TEMPLATES), [theme.id]); assert.deepEqual(h.favoriteDesigns({}, h.TEMPLATES), []);
});
await mkdir(path.join(root, 'docs/evidence/osam-import-20261003'), { recursive: true });
await writeFile(path.join(root, 'docs/evidence/osam-import-20261003/unit.json'), JSON.stringify({ observedAt: new Date().toISOString(), checks }, null, 2) + '\n');
console.log(`${checks.length} checks passed`);

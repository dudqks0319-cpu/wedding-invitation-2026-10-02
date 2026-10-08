import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../app/src/main/assets/bridge.js', import.meta.url), 'utf8');
const site = 'https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site';
let groups = 0;
function fixture(origin = site, main = true) {
  const handlers = new Map(), sent = [], documentHandlers = [], blobs = new Map();
  class Anchor {constructor(href, download = '') {this.href = href; this.download = download; this.originalClicks = 0;} click() {this.originalClicks++;}}
  class Reader {readAsDataURL(blob) {this.result = `data:${blob.type};base64,${Buffer.from(blob.bytes).toString('base64')}`; queueMicrotask(() => this.onload());}}
  const window = {addEventListener:(type, fn) => {if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type).add(fn);},
    removeEventListener:(type, fn) => handlers.get(type)?.delete(fn)};
  window.top = main ? window : {};
  const context = vm.createContext({window, location:{origin}, document:{addEventListener:(type, fn) => documentHandlers.push(fn)},
    HTMLAnchorElement:Anchor, FileReader:Reader,
    fetch:async url => {if (!blobs.has(url)) throw new Error('missing'); return {blob:async () => blobs.get(url)};}});
  function inject(nonce) {vm.runInContext(source.replace('__NATIVE_CHANNEL_NONCE__', nonce), context);}
  function post(data, portCount = 1) {
    const port = {closed:false, postMessage(message) {if (!this.closed) sent.push(JSON.parse(message));}, close() {this.closed = true;}};
    for (const handler of [...handlers.get('message') ?? []]) handler({data, origin:'', ports:Array(portCount).fill(port)});
    return port;
  }
  return {window, sent, blobs, Anchor, documentHandlers, inject, post};
}
const flush = () => new Promise(resolve => setImmediate(resolve));
for (const f of [fixture('https://evil.invalid'), fixture(site, false)]) {
  f.inject('nonce'); f.post('nonce'); assert.equal(f.window.webkit, undefined); groups++;
}
{
  const f = fixture(); f.inject('native-nonce');
  f.post('wrong'); f.post('native-nonce', 0); f.post('native-nonce', 2);
  assert.equal(f.window.webkit, undefined); f.post('native-nonce');
  assert.equal(f.window.webkit.messageHandlers.weddingAuth.supportsApple, false);
  f.window.webkit.messageHandlers.weddingAuth.postMessage('google');
  assert.deepEqual(f.sent, [{kind:'auth', body:'google'}]); groups++;
}
{
  const f = fixture(); f.inject('first'); const first = f.post('first');
  const click = f.Anchor.prototype.click;
  f.inject('second'); f.post('first'); assert.equal(first.closed, false);
  f.post('second'); assert.equal(first.closed, true);
  assert.equal(f.Anchor.prototype.click, click); assert.equal(f.documentHandlers.length, 1);
  f.window.webkit.messageHandlers.weddingAuth.postMessage('kakao');
  assert.deepEqual(f.sent, [{kind:'auth', body:'kakao'}]); groups++;
}
{
  const f = fixture(); f.inject('nonce'); f.post('nonce');
  for (const href of ['https://evil.invalid/file', 'blob:https://evil.invalid/1', site + '/my']) {
    const a = new f.Anchor(href, 'x.csv'); a.click(); assert.equal(a.originalClicks, 1);
  }
  const ordinary = new f.Anchor(`blob:${site}/1`); ordinary.click(); assert.equal(ordinary.originalClicks, 1);
  assert.equal(f.sent.length, 0); groups++;
}
{
  const f = fixture(); f.inject('nonce'); f.post('nonce');
  const url = `blob:${site}/1`; f.blobs.set(url, {type:'text/csv', size:5, bytes:'hello'});
  const a = new f.Anchor(url, '참석.csv'); a.click(); a.click(); await flush();
  assert.equal(a.originalClicks, 0); assert.equal(f.sent.length, 1);
  assert.deepEqual(f.sent[0], {kind:'file', body:{name:'참석.csv', type:'text/csv', data:'aGVsbG8='}}); groups++;
}
{
  const f = fixture(); f.inject('nonce'); f.post('nonce');
  for (const size of [0, 10485761]) {
    const url = `blob:${site}/${size}`; f.blobs.set(url, {type:'image/png', size, bytes:''});
    new f.Anchor(url, 'x.png').click(); await flush();
  }
  assert.deepEqual(f.sent, [{kind:'file',body:{error:'download'}}, {kind:'file',body:{error:'download'}}]); groups++;
}
{
  const f = fixture(); f.inject('first'); f.post('first');
  const url = `blob:${site}/1`; f.blobs.set(url, {type:'text/csv', size:5, bytes:'hello'});
  new f.Anchor(url, '참석.csv').click();
  f.inject('second'); f.post('second'); await flush();
  assert.equal(f.sent.length, 0); groups++;
}
console.log(`PASS Android bridge groups=${groups} (isolated JS DOM fixture; not Android runtime)`);

(() => {
  if (location.origin !== 'https://wedding-invitation-2026-10-02.jyb1126.chatgpt.site' || window !== window.top) return;
  const first = !window.__weddingAndroidBridge;
  const bridge = window.__weddingAndroidBridge ||= {port:null, waiting:null, busy:false};
  // Native confines delivery to this exact main-frame origin. A fresh document
  // nonce rejects unrelated messages, without assuming a platform event.origin.
  if (bridge.waiting) window.removeEventListener('message', bridge.waiting);
  function connect(event) {
    if (event.data !== '__NATIVE_CHANNEL_NONCE__' || event.ports.length !== 1) return;
    window.removeEventListener('message', connect); bridge.waiting = null;
    if (bridge.port) bridge.port.close();
    bridge.port = event.ports[0];
    window.webkit = {messageHandlers:{
      weddingAuth:{supportsApple:false, postMessage:provider => send('auth', provider)},
      osamDownload:{postMessage:body => send('file', body)}
    }};
  }
  bridge.waiting = connect;
  window.addEventListener('message', connect);
  function send(kind, body) {if (bridge.port) bridge.port.postMessage(JSON.stringify({kind, body}));}
  if (!first) return;
    const original = HTMLAnchorElement.prototype.click;
    function transfer(anchor) {
      if (!bridge.port || !anchor.download || !anchor.href.startsWith('blob:' + location.origin + '/')) return false;
      if (bridge.busy) return true;
      bridge.busy = true;
      const port = bridge.port;
      fetch(anchor.href).then(response => response.blob()).then(blob => {
        if (!blob.size || blob.size > 10485760) throw new Error('size');
        return new Promise((resolve, reject) => {
          const reader = new FileReader(); reader.onerror = reject;
          reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(blob);
        }).then(data => {if (port === bridge.port) port.postMessage(JSON.stringify({kind:'file',body:{name:anchor.download, type:blob.type, data}}));});
      }).catch(() => {if (port === bridge.port) port.postMessage(JSON.stringify({kind:'file',body:{error:'download'}}));})
        .finally(() => {bridge.busy = false;});
      return true;
    }
    HTMLAnchorElement.prototype.click = function() {if (!transfer(this)) return original.call(this);};
    document.addEventListener('click', event => {
      const anchor = event.target.closest && event.target.closest('a[download]');
      if (anchor && transfer(anchor)) event.preventDefault();
    }, true);
})();

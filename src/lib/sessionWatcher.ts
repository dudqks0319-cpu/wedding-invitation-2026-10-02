type Callbacks = {
  readIdentity: () => Promise<string | null>;
  hide: () => void;
  show: (identity:string|null) => void;
  reload: () => void;
  fail: () => void;
};

export function isPrivateView(pathname: string) {
  return /^\/(my|create|settings|support|operations)(\/|$)/.test(pathname)
    || (/^\/i\//.test(pathname) && !pathname.startsWith('/i/sample-'));
}

/** An embedded input owns focus without leaving the authenticated document. */
export function isEmbeddedFocus(hasFocus: boolean, visibility: string, activeTag?: string) {
  return hasFocus && visibility === 'visible' && activeTag === 'IFRAME';
}

/** Keep private screens covered until the current cookie's identity is checked. */
export function createSessionWatcher(callbacks: Callbacks) {
  let identity: string | null | undefined;
  let generation = 0;
  return {
    pause() { generation++; callbacks.hide(); },
    dispose() { generation++; },
    async check() {
      const current = ++generation;
      callbacks.hide();
      try {
        const next = await callbacks.readIdentity();
        if (current !== generation) return;
        if (identity !== undefined && identity !== next) {
          // Reload clears every cached response and remounts account-scoped drafts.
          callbacks.reload();
          return;
        }
        identity = next;
        callbacks.show(next);
      } catch {
        if (current === generation) callbacks.fail();
      }
    },
  };
}

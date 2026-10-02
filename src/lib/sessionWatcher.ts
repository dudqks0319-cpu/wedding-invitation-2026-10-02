type Callbacks = {
  readIdentity: () => Promise<string | null>;
  hide: () => void;
  show: () => void;
  reload: () => void;
  fail: () => void;
};

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
        callbacks.show();
      } catch {
        if (current === generation) callbacks.fail();
      }
    },
  };
}

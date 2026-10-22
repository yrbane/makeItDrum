// Client du compagnon local « makeitdrum-bridge » (voir tools/bridge/) : détection
// silencieuse au chargement, envoi du zip Ableton. Tout échec de réseau = absent.

export const BRIDGE_BASE = 'http://127.0.0.1:47800';

export function createBridgeClient(fetchFn, base = BRIDGE_BASE, { timeout = 1000 } = {}) {
  function withTimeout(ms) {
    const ctl = new AbortController();
    const id = setTimeout(function () { ctl.abort(); }, ms);
    return { signal: ctl.signal, done: function () { clearTimeout(id); } };
  }

  return {
    async health() {
      const t = withTimeout(timeout);
      try {
        const res = await fetchFn(base + '/health', { signal: t.signal });
        if (!res.ok) return null;
        const info = await res.json();
        return info && info.app === 'makeitdrum-bridge' ? info : null;
      } catch (e) {
        return null;
      } finally {
        t.done();
      }
    },
    async sendKit(name, bytes) {
      const res = await fetchFn(base + '/kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip', 'X-Kit-Name': name },
        body: bytes,
      });
      const body = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(body.error || ('HTTP ' + res.status));
      return body;
    },
  };
}

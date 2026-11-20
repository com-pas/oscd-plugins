import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import '@webcomponents/scoped-custom-element-registry';

const require = createRequire(import.meta.url);
const originalFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (url.includes('nsd.json')) {
    const nsdPath = require.resolve(
      '@openenergytools/scl-lib/dist/foundation/nsd.json',
    );
    return new Response(readFileSync(nsdPath, 'utf8'), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return originalFetch(input, init);
}) as typeof fetch;

const define = window.customElements.define.bind(window.customElements);
window.customElements.define = (name, ctor, options) => {
  if (customElements.get(name)) return;
  try {
    define(name, ctor, options);
  } catch {
    // already registered in this happy-dom window
  }
};

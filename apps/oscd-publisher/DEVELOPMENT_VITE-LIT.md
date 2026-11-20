# Why this Lit plugin uses Vite

This app is a **Lit** OpenSCD editor plugin. Production output is a single ES module
`dist/apps/oscd-publisher/index.js` that OpenSCD / CoMPAS loads by URL.

The plugin pulls in **Lit + several `@openenergytools/*` packages** that were
authored for `@web/dev-server` + Rollup, not for Vite. The extra Vite knobs
exist to make those packages work. The playground itself is plain TypeScript.

Ports are hardcoded: **4201** (`run`) and **4301** (`preview`), `strictPort: false`.

---

## 1. Why Vite instead of `tsc`?

`tsc` only rewrites TypeScript to JavaScript. It does **not** bundle. The compiled
entry still contains bare imports:

```js
import { html, LitElement } from 'lit';
import { MdRadio } from '@scopedelement/material-web/radio/radio.js';
```

That is what you see if `dist/oscd-publisher.js` is ~**6.4 kB** after `tsc` (or after
`npm start` in the upstream repo). The browser (and OpenSCD) cannot resolve `lit`
from a single plugin URL.

| Command (upstream `oscd-publisher`) | What you get |
|-------------------------------------|----------------|
| `tsc` / `npm start` | One `.js` per `.ts`, plus `@web/dev-server` `nodeResolve` for **local demo only** |
| `rollup -c` (`npm run build`) | One plugin file + sibling assets, meant for OpenSCD |
| Official file at [openscd.github.io/external-plugins/oscd-publisher/oscd-publisher.js](https://openscd.github.io/external-plugins/oscd-publisher/oscd-publisher.js) | \~**2.1 MB** bundled JS; `nsd.json` is a **separate** `assets/nsd-*.json` (\~3.5 MB) fetched at runtime |

This Nx repo already runs every app with **Vite**: `run:` / `preview:` / `build:` /
Vitest. Vite here plays the same role as Rollup upstream: produce a **self-contained
plugin** the host can `import(url)`.

Vite is **not** a rewrite of the UI. The editors stay Lit.

**Advantages vs `tsc` + WDS in this monorepo**

- Same Nx scripts as the Svelte plugin (`run:oscd-publisher`, `preview:…`, `build:…`).
- One `index.js` for CoMPAS (`customElements.define(tag, mod.default)`).
- Dev server + playground (`main.ts` + fake host) without a second tool (`wds`).
- Vitest instead of a second test runner for unit specs.

`tsc` remains useful for typecheck (`nx run oscd-publisher:check`). It is not the
OpenSCD ship format.

---

## 2. Bundle size: 6.4 kB vs 2.1 MB vs 6.4 MB

Three different artefacts:

| Artefact | Size | What it is |
|----------|------|------------|
| Upstream `dist/oscd-publisher.js` after **`tsc`** | ~6.4 **kB** | Entry file only. Still `import`s `lit` / Material / scl-lib. **Not** loadable by OpenSCD alone. |
| Official **bundled** `oscd-publisher.js` | \~2.1 **MB** | Rollup bundle of plugin + Lit + Material + scl-lib JS. NSD **JSON** is **not** inside the JS: `fetch(new URL('assets/nsd-….json', import.meta.url))`. Extra \~3.5 MB on first use. |
| This repo `dist/apps/oscd-publisher/index.js` | \~6.4 **MB** | Vite lib bundle of the same JS, **plus** `scl-lib`’s `nsd.json` inlined as a `data:application/json;base64,…` URL. Base64 adds \~33% to the 3.47 MB JSON (\~4.6 MB) on top of \~2 MB of JS. |

`nsd.json` is IEC 61850 type data used by `@openenergytools/scl-lib`
(`extRefTypeRestrictions.js` does `await fetch(new URL('../foundation/nsd.json', import.meta.url))`).
The official Rollup build uses `importMetaAssets` and **emits a sibling file**.
Vite currently inlines that JSON into `index.js` (even with `assetsInlineLimit: 0`),
which is why this bundle is larger than 2.1 MB and is a **single** download.

Gzip of the 6.4 MB file is ~320 kB; the host still parses 6.4 MB of JS.

---

## 3. Extra complexity

The playground is plain TypeScript: Nx paths, ports, Vitest, and a subscriber
that copies `doc` / `editCount` onto the Lit element (`bind-fake-host.ts`).

This app also needs Lit decorator settings and workarounds for
`@openenergytools/*` packages that assume WDS/Rollup.

---

## 4. What each extra piece is for

Legend:

- **Lit** — needed because the UI is Lit (decorators / one-file plugin).
- **openenergytools** — needed because of `@openenergytools/scl-lib`, `xml-lib`, `open-scd-core`.
- **Playground vs `index.js`** — needed to keep `main.ts` (fake host) off the production entry.
- **Nx / repo** — same as the Svelte app.
- **Other** — leftover interop or cache.

### Nx / repo

| Setting | Why |
|---------|-----|
| `root`, `cacheDir` | App lives under `apps/`; Vite cache stays in workspace `node_modules`. |
| `server.port: 4201`, `preview.port: 4301`, `strictPort: false` | Shared playground ports; next free port if busy. |
| `server.fs.allow` (workspace root) | Playground CSS/fonts live in `libs/global`. |
| `nxViteTsPaths()` | Nx path aliases. |
| `test.cache.dir: ../../node_modules/.vitest` | Do not create `apps/oscd-publisher/node_modules`. |
| `commonjsOptions.transformMixedEsModules` | CJS/ESM mixed dependencies. |

### Playground vs production `index.js`

| Setting | Why |
|---------|-----|
| `build.lib.entry: src/oscd-publisher.ts` | OpenSCD default-export Custom Element. **Not** `main.ts`. |
| `entryFileNames: 'index.js'` | Host `src` is one file. |
| `index.html` + `src/main.ts` | Vite serve playground only. |
| `bind-fake-host.ts` | Subscribes to `fakeHostProps` and copies `doc` / `editCount`. Production entry does not import it. |
| `isVitest` skips `server.port` | Vitest must not steal 4201. |
| `tsconfig.app.json` excludes `main.ts`, `bind-fake-host.ts` | Production typecheck / build graph stays the plugin entry only. |

### Lit integration

| Setting | Why |
|---------|-----|
| `tsconfig` `experimentalDecorators` + `useDefineForClassFields: false` | Lit `@property` (Vite reads `apps/oscd-publisher/tsconfig.json`). |
| `verbatimModuleSyntax: false` | Mixed value/type imports (`TemplateResult`, `Insert`) must be erased. With `true`, the browser requested a runtime export `Insert` that `open-scd-core` does not ship. |
| `import type { Insert, Tree, ActionItem, … }` | Same issue, explicit. |
| `resolve.dedupe` for `lit` / `lit-html` / `lit-element` | Nested Lit 2 (e.g. old `@compas-oscd/core` / MWC) vs Lit 3. |
| Local `foundation/log-event.ts` instead of `@compas-oscd/core` | Avoid pulling Lit 2 through that package’s barrel file. |

`es2022` as a **build target** is **not** required by Lit 3 (Lit is fine on older
targets). It is required by **scl-lib** (next section).

### `@openenergytools/*` workarounds

| Setting | Why |
|---------|-----|
| `esbuild.target` / `build.target` / `optimizeDeps.esbuildOptions.target: 'es2022'` | `scl-lib` uses **top-level await** for `nsd.json`. Vite’s default optimizeDeps target (`chrome87`) cannot parse it. |
| `optimizeDeps.exclude: ['@openenergytools/scl-lib']` | Prebundling rewrites `import.meta.url`, so `../foundation/nsd.json` hits the HTML fallback (`<!doctype …> is not valid JSON`). |
| Plugin `serveSclLibNsdJson` | Serves the real `nsd.json` if a request still asks for `foundation/nsd.json`. |
| Plugin `resolveExtensionlessJs` | `@openenergytools/xml-lib` ESM imports `./editv2` **without** `.js`. Node/Vite ESM needs the extension. |
| `test.server.deps.inline` for xml-lib / open-scd-core / scl-lib / … | Vitest must transform those packages instead of loading broken native ESM. |
| `src/vitest.setup.ts` fetch mock for `nsd.json` | jsdom has no Vite middleware; scl-lib’s `fetch(nsd.json)` would fail in tests. |
| Scoped Custom Element Registry polyfill in `main.ts` + vitest setup | Material Web / `ScopedElementsMixin` (Lit OpenSCD plugins). |

### Other

| Setting | Why |
|---------|-----|
| `assetsInlineLimit: 0` | Attempt to emit `nsd.json` as a sibling file like official Rollup. **Vite still inlines it as base64** today — that is why `index.js` is ~6.4 MB. Fixing that would mean teaching Vite `new URL(..., import.meta.url)` inside `node_modules` to emit `assets/nsd-*.json` (official Rollup `importMetaAssets` behaviour). |

---

## 5. What the extra Vite settings are

The settings beyond a plain Vite lib build are `@openenergytools/*` interop,
Lit decorator / `import type` handling, and keeping `main.ts` out of `index.js`.
Lit uses `static styles`. It does not need `inlineCssIntoJs`.

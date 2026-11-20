# Developer Guide

## Start

```bash
pnpm install
pnpm verify
pnpm run run:oscd-publisher
```

Open http://localhost:4201 (or the next free port Vite prints).

| Script | Hot reload | What you get |
|--------|------------|----------------|
| `pnpm run run:oscd-publisher` | Auto | Standalone Lit publisher and the theme/document playground |
| `pnpm run preview:oscd-publisher` | Manual | Production `index.js` (Lit bundle) |
| `pnpm run build:oscd-publisher` | — | `dist/apps/oscd-publisher/index.js` for OpenSCD |
| `pnpm verify` | — | Lint, typecheck, and test for every project |
| `pnpm build` | — | `dist/apps/<name>/index.js` for every plugin |

Plugins use port **4201** (`run`) and **4301** (`preview`). If the port is taken, Vite picks the next free one.

There is no Open/Save in the playground. Pick an SCL file in the toolbar.

---

## Host theme playground (standalone only)

Standalone `run:*` checks host theming and sample SCL on the real plugin page without registering the plugin in OpenSCD / CoMPAS.

Runtime is wired from each app's `src/main.ts` only, not from the production plugin entry.

### How presets are maintained

| Piece | Role |
|--------|------|
| `libs/global/dev/host-theme-presets.css` | Source of truth. Brand and mode classes on `<html>` set `--oscd-theme-*` / `--oscd-*` |
| `libs/global/dev/host-themes.ts` | Brand labels and class-name helpers for the toolbar |
| `libs/global/dev/theme-playground.ts` | Toggles brand and mode classes on `<html>`, plus toolbar, query, and localStorage. Sets `color-scheme` so `light-dark()` resolves |

JavaScript does not set individual CSS variables. To add a brand, add an `html.{brand}` block in the CSS and one entry in `HOST_THEME_PRESETS`.

| Control | Options |
|---------|---------|
| Brand preset | `openscd` (default), `bearingpoint`, `weidmueller` |
| Mode | `light` / `dark` |
| SCL document | Subset from `libs/global/dev/files/` |
| XML | Right-hand inspector. Formatted SCL, live after edits. Drag the left edge to resize. Disabled with tooltip `SCD file too big to format` when the source is larger than `XML_INSPECTOR_MAX_BYTES` in `xml-inspector.ts` (100 kB) |

Theme priority on load: query, then `localStorage` (`plugin-dev-theme`), then `HOST_THEME_DEFAULT_*` (`openscd` / `light`).

```text
http://localhost:4201/?brand=openscd&mode=light
http://localhost:4201/?brand=weidmueller&mode=dark
```

### Fonts (standalone only)

Production inherits Roboto, Roboto Mono, and Material Symbols Outlined from the host and must not ship `@font-face` files. Icon classes for Shadow DOM live in `libs/global/oscd-typography.css`. The default icon font is `Material Symbols Outlined` (not the legacy `Material Icons` value some old hosts set on `--oscd-icon-font`).

Standalone `run:*` registers the same faces via `libs/global/dev/oscd-fonts.css`.

---

## Playground SCL documents

The toolbar document select writes `fakeHostProps.doc` / `fakeHostProps.docName`. Subscribers are told through `notifyFakeHost()`. A plugin `main.ts` calls `subscribeFakeHost()` and copies `doc` and `editCount` onto the element.

Each plugin opts in from `main.ts`:

```ts
await initThemePlayground({
  relevantDocs: ['sample-ieds.scd', 'new-project-1.scd'],
  defaultDoc: 'sample-ieds.scd',
});
```

- `relevantDocs` — filenames shown in the select. They must exist in the catalog.
- `defaultDoc` — used the first time, when nothing is stored or the stored file is not in `relevantDocs`.
- The last selection is remembered in `localStorage` (`plugin-dev-doc`).
- Unknown names throw at startup.

### Adding a test file

1. Drop the `.scd` into `libs/global/dev/files/`.
2. Register it in `libs/global/dev/playground-docs.ts`. Small files are `?raw` imports. A file that should not sit in the JavaScript module graph uses `{ kind: 'url' }` and is fetched at runtime. `ABC_Large_File_anonymised_updated_3.scd` is that entry.
3. Add the filename to `relevantDocs` (and `defaultDoc` if needed) in the plugin `main.ts`.

---

## Preview inside CoMPAS OpenSCD

Use this for an end-to-end check of the plugin inside the host (events, layout, real theme).

**Terminal 1** — `pnpm run preview:<plugin>`

**Terminal 2:**

```bash
git clone https://github.com/com-pas/compas-open-scd
pnpm install
pnpm start
```

Open http://localhost:8080 and register the plugin with `http://localhost:4301/index.js`. That URL is the production bundle. Do not point the host at the playground `main.ts`.

Lit editor specs (`*-editor.spec.ts`) are skipped under Node. jsdom and happy-dom have no Material Web `ElementInternals`. Utility `*.spec.ts` files run under Vitest.

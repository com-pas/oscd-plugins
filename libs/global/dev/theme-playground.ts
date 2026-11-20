/**
 * Dev-only host theme playground: toggle brand + mode classes on <html>
 * (e.g. html.{brand}.light). Variable values live in host-theme-presets.css.
 *
 * UX: full-width bar in `#app`, above the plugin. Optional ?brand=&mode= query params.
 * Import only from app main.ts (never from the production plugin entry).
 */
import './host-theme-presets.css';
import './oscd-fonts.css';
import {
  HOST_THEME_CLASSES,
  HOST_THEME_PRESETS,
  HOST_MODE_PRESETS,
  HOST_THEME_DEFAULT_BRAND,
  HOST_THEME_DEFAULT_MODE,
  normalizeBrand,
  type ThemeBrand,
  type ThemeMode,
} from './host-themes';
import {
  applyPlaygroundDocument,
  assertPlaygroundDocOptions,
  type ThemePlaygroundDocOptions,
} from './playground-docs';
import {
  isXmlInspectorBlocked,
  isXmlInspectorOpen,
  mountXmlInspector,
  toggleXmlInspector,
  XML_INSPECTOR_TOO_LARGE_HINT,
} from './xml-inspector';

const STORAGE_KEY = 'plugin-dev-theme';
const DOC_STORAGE_KEY = 'plugin-dev-doc';
const TOOLBAR_ID = 'plugin-theme-playground';
const LAYOUT_STYLE_ID = 'plugin-theme-playground-layout';

/** Query keys for shareable local smoke-test links. */
export const THEME_QUERY_BRAND = 'brand';
export const THEME_QUERY_MODE = 'mode';

export interface ThemePlaygroundState {
  brand: ThemeBrand;
  mode: ThemeMode;
}

function isThemeBrand(value: string): value is ThemeBrand {
  return HOST_THEME_PRESETS.some((p) => p.brand === value);
}

function isThemeMode(value: string): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

/**
 * Read theme from URL query (`?brand=transnetbw&mode=dark`).
 */
export function readThemeFromQuery(
  search = typeof window !== 'undefined' ? window.location.search : '',
): Partial<ThemePlaygroundState> {
  const params = new URLSearchParams(search);
  const result: Partial<ThemePlaygroundState> = {};

  const brand = normalizeBrand(params.get(THEME_QUERY_BRAND) ?? undefined);
  if (brand) {
    result.brand = brand;
  }

  const mode = params.get(THEME_QUERY_MODE);
  if (mode && isThemeMode(mode)) {
    result.mode = mode;
  }

  return result;
}

export function writeThemeToQuery(state: ThemePlaygroundState): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  url.searchParams.set(THEME_QUERY_BRAND, state.brand);
  url.searchParams.set(THEME_QUERY_MODE, state.mode);
  window.history.replaceState(null, '', url.toString());
}

/**
 * Load selection: query params → localStorage → OpenSCD light.
 */
export function loadThemeState(): ThemePlaygroundState {
  const fromQuery = readThemeFromQuery();
  const fromStorage: Partial<ThemePlaygroundState> = {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ThemePlaygroundState> & {
        brand?: string;
      };
      const brand = normalizeBrand(parsed.brand);
      if (brand) {
        fromStorage.brand = brand;
      }
      if (parsed.mode && isThemeMode(parsed.mode)) {
        fromStorage.mode = parsed.mode;
      }
    }
  } catch {
    /* ignore corrupt storage */
  }

  return {
    brand: fromQuery.brand ?? fromStorage.brand ?? HOST_THEME_DEFAULT_BRAND,
    mode: fromQuery.mode ?? fromStorage.mode ?? HOST_THEME_DEFAULT_MODE,
  };
}

function saveThemeState(state: ThemePlaygroundState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Apply host theme by setting brand + mode as separate classes on <html>
 * (for example openscd and light). color-scheme follows the mode so
 * CSS light-dark() resolves.
 */
export function applyHostTheme(state: ThemePlaygroundState): void {
  const root = document.documentElement;

  root.classList.remove(...HOST_THEME_CLASSES);
  root.classList.remove(...HOST_MODE_PRESETS);
  root.classList.add(state.brand);
  root.classList.add(state.mode);
  root.dataset.themeBrand = state.brand;
  root.dataset.themeMode = state.mode;
  root.style.colorScheme = state.mode;

  // Clear any leftover inline body background from older playground versions
  document.body.style.background = '';

  saveThemeState(state);
  writeThemeToQuery(state);
}

function loadStoredDocName(): string | undefined {
  try {
    return localStorage.getItem(DOC_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function saveStoredDocName(name: string): void {
  try {
    localStorage.setItem(DOC_STORAGE_KEY, name);
  } catch {
    /* ignore */
  }
}

function resolvePlaygroundDocName(
  options: ThemePlaygroundDocOptions,
): string {
  const stored = loadStoredDocName();
  if (stored && options.relevantDocs.includes(stored)) return stored;
  return options.defaultDoc;
}

function applySelectStyles(select: HTMLSelectElement): void {
  Object.assign(select.style, {
    fontSize: '12px',
    padding: '4px 6px',
    borderRadius: '4px',
    border: '1px solid #555',
    background: '#1a1a1a',
    color: '#f5f5f5',
    maxWidth: '100%',
  });
}

function applyButtonStyles(button: HTMLButtonElement): void {
  Object.assign(button.style, {
    fontSize: '12px',
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid #555',
    background: '#2a2a2a',
    color: '#f5f5f5',
    cursor: 'pointer',
  });
}

/** `#app` is a column: the bar keeps its height, the plugin fills the rest. */
function ensurePlaygroundColumn(): HTMLElement {
  const host = document.getElementById('app') ?? document.body;
  if (host.id !== 'app' || document.getElementById(LAYOUT_STYLE_ID)) return host;

  const style = document.createElement('style');
  style.id = LAYOUT_STYLE_ID;
  style.textContent = `
    #app:has(> #${TOOLBAR_ID}) {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    #app > #${TOOLBAR_ID} {
      flex: 0 0 auto;
    }
    #app > :not(#${TOOLBAR_ID}) {
      flex: 1 1 auto;
      min-height: 0;
      height: auto !important;
    }
  `;
  document.head.appendChild(style);
  return host;
}

/**
 * Mount the playground bar as the first child of `#app`.
 * The plugin is appended afterwards and fills the remaining height.
 */
export function mountThemeToolbar(
  initial: ThemePlaygroundState,
  docOptions: ThemePlaygroundDocOptions,
  selectedDoc: string,
): { syncXmlBtn: () => void } {
  if (document.getElementById(TOOLBAR_ID)) {
    return { syncXmlBtn: () => undefined };
  }

  let state: ThemePlaygroundState = { ...initial };

  const bar = document.createElement('div');
  bar.id = TOOLBAR_ID;
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Playground');
  Object.assign(bar.style, {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    boxSizing: 'border-box',
    width: '100%',
    padding: '8px 12px',
    background: 'rgba(0, 0, 0, 0.78)',
    color: '#f5f5f5',
    borderBottom: '1px solid #333',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '12px',
  });

  const brandSelect = document.createElement('select');
  brandSelect.setAttribute('aria-label', 'Host brand preset');
  applySelectStyles(brandSelect);
  for (const preset of HOST_THEME_PRESETS) {
    const opt = document.createElement('option');
    opt.value = preset.brand;
    opt.textContent = preset.label;
    if (preset.brand === state.brand) opt.selected = true;
    brandSelect.appendChild(opt);
  }

  const modeBtn = document.createElement('button');
  modeBtn.type = 'button';
  modeBtn.setAttribute('aria-label', 'Toggle light and dark mode');
  applyButtonStyles(modeBtn);

  const syncModeBtn = () => {
    modeBtn.textContent = state.mode === 'light' ? 'Light ☀' : 'Dark ☾';
  };
  syncModeBtn();

  const apply = () => {
    applyHostTheme(state);
    syncModeBtn();
    brandSelect.value = state.brand;
  };

  brandSelect.addEventListener('change', () => {
    const value = brandSelect.value;
    if (isThemeBrand(value)) {
      state = { ...state, brand: value };
      apply();
    }
  });

  modeBtn.addEventListener('click', () => {
    state = {
      ...state,
      mode: state.mode === 'light' ? 'dark' : 'light',
    };
    apply();
  });

  const docSelect = document.createElement('select');
  docSelect.setAttribute('aria-label', 'Playground SCL document');
  applySelectStyles(docSelect);
  for (const name of docOptions.relevantDocs) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === selectedDoc) opt.selected = true;
    docSelect.appendChild(opt);
  }
  docSelect.addEventListener('change', () => {
    void applyPlaygroundDocument(docSelect.value).then(() => {
      saveStoredDocName(docSelect.value);
      syncXmlBtn();
    });
  });

  const xmlBtnWrap = document.createElement('span');
  xmlBtnWrap.style.display = 'inline-flex';

  const xmlBtn = document.createElement('button');
  xmlBtn.type = 'button';
  xmlBtn.setAttribute('aria-label', 'Toggle SCL XML inspector');
  applyButtonStyles(xmlBtn);
  const syncXmlBtn = () => {
    const blocked = isXmlInspectorBlocked();
    xmlBtn.disabled = blocked;
    xmlBtn.style.opacity = blocked ? '0.45' : '1';
    xmlBtn.style.cursor = blocked ? 'not-allowed' : 'pointer';
    xmlBtnWrap.title = blocked ? XML_INSPECTOR_TOO_LARGE_HINT : '';
    xmlBtn.textContent = !blocked && isXmlInspectorOpen() ? 'XML ●' : 'XML';
  };
  syncXmlBtn();
  xmlBtn.addEventListener('click', () => {
    toggleXmlInspector();
    syncXmlBtn();
  });
  xmlBtnWrap.appendChild(xmlBtn);

  bar.append(brandSelect, modeBtn, docSelect, xmlBtnWrap);
  const host = ensurePlaygroundColumn();
  host.insertBefore(bar, host.firstChild);
  return { syncXmlBtn };
}

/**
 * Initialise playground: apply query/stored/default theme, load an SCL
 * document into `fakeHostProps`, and show the toolbar.
 */
export async function initThemePlayground(
  options: ThemePlaygroundDocOptions,
): Promise<ThemePlaygroundState> {
  assertPlaygroundDocOptions(options);

  const state = loadThemeState();
  applyHostTheme(state);

  const docName = resolvePlaygroundDocName(options);
  await applyPlaygroundDocument(docName);
  saveStoredDocName(docName);

  const toolbar = mountThemeToolbar(state, options, docName);
  mountXmlInspector();
  toolbar.syncXmlBtn();
  console.log(
    '%c[Dev] Host theme classes on <html> — toolbar or ?brand=&mode=',
    'color:#0ea5e9; font-weight:bold',
  );
  return state;
}

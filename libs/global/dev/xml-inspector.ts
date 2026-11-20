import { fakeHostProps } from './fake-host-props';
import { formatXml } from './format-xml';

const ROOT_ID = 'plugin-xml-inspector';
const OPEN_KEY = 'plugin-dev-xml-open';
const WIDTH_KEY = 'plugin-dev-xml-width';
const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 280;

/** Skip pretty-printing the XML inspector above this UTF-8 source size. */
export const XML_INSPECTOR_MAX_BYTES = 100 * 1024;

export const XML_INSPECTOR_TOO_LARGE_HINT = 'SCD file too big to format';

let root: HTMLElement | null = null;
let titleEl: HTMLElement | null = null;
let pre: HTMLPreElement | null = null;
let open = false;
let width = DEFAULT_WIDTH;
let sourceTooLarge = false;

export function isXmlSourceTooLarge(source: string): boolean {
  return new TextEncoder().encode(source).length > XML_INSPECTOR_MAX_BYTES;
}

export function isXmlInspectorBlocked(): boolean {
  return sourceTooLarge;
}

export function mountXmlInspector(): void {
  if (document.getElementById(ROOT_ID)) return;

  open = loadFlag(OPEN_KEY);
  width = loadWidth();

  root = document.createElement('aside');
  root.id = ROOT_ID;
  root.setAttribute('aria-label', 'SCL document XML');
  Object.assign(root.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    bottom: '0',
    zIndex: '9990',
    display: 'flex',
    flexDirection: 'column',
    background: '#111',
    color: '#f5f5f5',
    boxShadow: '-4px 0 16px rgba(0,0,0,0.35)',
    fontFamily: 'system-ui, sans-serif',
  });

  const handle = document.createElement('div');
  handle.setAttribute('aria-label', 'Resize XML panel');
  handle.setAttribute('role', 'separator');
  Object.assign(handle.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '6px',
    height: '100%',
    cursor: 'ew-resize',
    background: 'transparent',
  });
  handle.addEventListener('mousedown', startResize);

  const header = document.createElement('div');
  Object.assign(header.style, {
    flex: '0 0 auto',
    padding: '8px 12px 8px 16px',
    borderBottom: '1px solid #333',
    fontSize: '12px',
    fontWeight: '600',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });
  titleEl = header;

  pre = document.createElement('pre');
  Object.assign(pre.style, {
    flex: '1 1 auto',
    margin: '0',
    padding: '12px 16px',
    overflow: 'auto',
    whiteSpace: 'pre',
    fontFamily: "'Roboto Mono', ui-monospace, SFMono-Regular, Consolas, monospace",
    fontSize: '12px',
    lineHeight: '1.4',
    tabSize: '2',
  });

  root.append(handle, header, pre);
  document.body.appendChild(root);
  if (sourceTooLarge) closeInspector();
  applyChrome();
  if (open) render();
}

export function toggleXmlInspector(): boolean {
  if (sourceTooLarge) {
    closeInspector();
    applyChrome();
    return false;
  }
  if (!root) mountXmlInspector();
  open = !open;
  saveFlag(OPEN_KEY, open);
  applyChrome();
  if (open) render();
  return open;
}

export function isXmlInspectorOpen(): boolean {
  return open;
}

/** Re-render when the SCL document changes. Pass source XML to refresh the size gate. */
export function syncXmlInspector(source?: string): void {
  if (source !== undefined) {
    sourceTooLarge = isXmlSourceTooLarge(source);
  }
  if (sourceTooLarge) {
    closeInspector();
    applyChrome();
    return;
  }
  if (open) render();
}

function closeInspector(): void {
  if (!open) return;
  open = false;
  saveFlag(OPEN_KEY, false);
}

function render(): void {
  if (!pre || !titleEl || sourceTooLarge) return;
  titleEl.textContent = fakeHostProps.docName || 'SCL document';
  pre.textContent = fakeHostProps.doc ? formatXml(fakeHostProps.doc) : '';
}

function applyChrome(): void {
  if (!root) return;
  root.style.display = open ? 'flex' : 'none';
  root.style.width = `${width}px`;
  document.body.style.paddingRight = open ? `${width}px` : '';
}

function startResize(event: MouseEvent): void {
  event.preventDefault();
  const startX = event.clientX;
  const startWidth = width;

  const onMove = (move: MouseEvent) => {
    const max = Math.max(MIN_WIDTH, Math.floor(window.innerWidth * 0.8));
    width = Math.min(max, Math.max(MIN_WIDTH, startWidth + (startX - move.clientX)));
    applyChrome();
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    saveWidth(width);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function saveFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function loadWidth(): number {
  try {
    const raw = Number(localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(raw) && raw >= MIN_WIDTH ? raw : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

function saveWidth(value: number): void {
  try {
    localStorage.setItem(WIDTH_KEY, String(value));
  } catch {
    /* ignore */
  }
}

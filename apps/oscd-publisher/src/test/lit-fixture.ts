import { describe, vi } from 'vitest';
import type { LitElement } from 'lit';
import type {
  ActionItem,
  ActionList,
} from '@openenergytools/filterable-lists/dist/ActionList.js';

/** Material Web form-associated elements need a real ElementInternals (not jsdom/happy-dom). */
export const canMountLitEditors =
  typeof ElementInternals !== 'undefined' &&
  typeof ElementInternals.prototype.setFormValue === 'function';

export const describeLitEditor: typeof describe = canMountLitEditors
  ? describe
  : describe.skip;

export async function mountLit<T extends LitElement>(
  tag: string,
  ctor: CustomElementConstructor,
  props: Record<string, unknown> = {},
): Promise<T> {
  if (!customElements.get(tag)) {
    customElements.define(tag, ctor);
  }

  const el = document.createElement(tag) as T;
  Object.assign(el, props);
  document.body.appendChild(el);
  await Promise.race([
    el.updateComplete,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`updateComplete timed out for <${tag}>`)), 3000);
    }),
  ]);
  return el;
}

export function listenEvent(type: string): {
  handler: ReturnType<typeof vi.fn>;
  stop: () => void;
} {
  const handler = vi.fn();
  window.addEventListener(type, handler);
  return {
    handler,
    stop: () => window.removeEventListener(type, handler),
  };
}

export function lastDetail(handler: ReturnType<typeof vi.fn>): {
  edit: unknown;
  title?: string;
  kind?: string;
  message?: string;
} {
  const event = handler.mock.calls.at(-1)?.[0] as CustomEvent;
  return event.detail;
}

export function actionItems(
  host: Element,
  selector = 'action-list',
): ActionItem[] {
  const list = host.shadowRoot?.querySelector(selector) as
    | (ActionList & { items: ActionItem[] })
    | null;
  if (!list) throw new Error(`${selector} not found`);
  return list.items ?? [];
}

export function selectionListRoot(host: Element): ShadowRoot {
  const list = host.shadowRoot?.querySelector('publisher-selection-list');
  if (!list?.shadowRoot) throw new Error('publisher-selection-list missing');
  return list.shadowRoot;
}

export function clickSelection(host: Element, selector: string): void {
  const node = selectionListRoot(host).querySelector(selector);
  if (!(node instanceof HTMLElement)) throw new Error(`${selector} not found`);
  node.click();
}

/** Clicks a create-dialog Add button once it is enabled. */
export async function clickCreateAdd(
  editor: LitElement,
  dialogSelector: string,
  buttonSelector: string,
): Promise<void> {
  const button = await waitForCreateButton(editor, dialogSelector, buttonSelector);
  button.click();
  await editor.updateComplete;
}

/** Add DataSet from a control detail. The dialog sits inside the element editor. */
export async function clickDetailDataSetAdd(editor: LitElement): Promise<void> {
  const host = editor.shadowRoot?.querySelector('data-set-element-editor');
  if (!host?.shadowRoot || !('updateComplete' in host)) {
    throw new Error('data-set-element-editor missing');
  }
  const button = await waitForCreateButton(
    host as LitElement,
    'data-set-edit-dialog',
    '.dataset.save',
  );
  button.click();
  await editor.updateComplete;
}

async function waitForCreateButton(
  host: LitElement,
  dialogSelector: string,
  buttonSelector: string,
): Promise<HTMLElement> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await host.updateComplete;
    const dialog = host.shadowRoot?.querySelector(dialogSelector);
    const button = dialog?.shadowRoot?.querySelector(buttonSelector);
    if (button instanceof HTMLElement && !button.hasAttribute('disabled')) {
      return button;
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  throw new Error(`${buttonSelector} in ${dialogSelector} stayed disabled`);
}

export function invokeAction(
  items: ActionItem[],
  icon: string,
  itemIndex?: number,
): void {
  const candidates =
    itemIndex === undefined ? items : [items[itemIndex]].filter(Boolean);
  for (const item of candidates) {
    const action = item.actions?.find((entry) => entry.icon === icon);
    if (action?.callback) {
      action.callback();
      return;
    }
  }
  throw new Error(`No action "${icon}" found`);
}

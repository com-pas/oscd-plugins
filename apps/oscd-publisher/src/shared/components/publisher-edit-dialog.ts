import { css, html, LitElement, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';

import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { MdDialog } from '@scopedelement/material-web/dialog/MdDialog.js';

/** Card used inside a publisher edit dialog. */
export const publisherEditCardStyles = css`
  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 0;
    padding: 16px;
    border-radius: var(--oscd-plugin-internal-shape-small);
    background: var(--oscd-plugin-internal-base3);
  }

  h3 {
    margin: 0;
    color: var(--oscd-plugin-internal-base03);
    font-size: 14px;
    font-weight: 500;
  }

  .dataset-lock {
    display: inline-flex;
  }

  .dataset-lock[title] {
    cursor: not-allowed;
  }

  .dataset-lock[title] md-outlined-button {
    pointer-events: none;
  }
`;

/**
 * Material paints no dialog shadow, and `md-dialog` is `display: contents`,
 * so a shadow on the host does not show. This is the inner `<dialog>`.
 */
const dialogShadow =
  '0 8px 16px 0 color-mix(in srgb, var(--oscd-plugin-internal-base03) 40%, transparent)';

/** Controls that already use Enter. A text field is not in this set. */
const enterControls = new Set([
  'button',
  'md-checkbox',
  'md-filled-button',
  'md-filled-select',
  'md-icon-button',
  'md-menu',
  'md-menu-item',
  'md-outlined-button',
  'md-outlined-select',
  'md-radio',
  'md-select-option',
  'md-text-button',
  'publisher-checkbox',
  'publisher-radio',
  'publisher-select',
]);

/** True when Enter should click the dialog's enabled Save button. */
export function editDialogEnterSaves(path: EventTarget[]): boolean {
  return !path.some(
    node => node instanceof Element && enterControls.has(node.localName),
  );
}

/**
 * Shared edit-dialog shell: dark title, base2 body, base3 actions.
 * Set `--publisher-edit-dialog-width` for the surface width.
 * Default slot is the body. `actions` slot is the buttons.
 */
export class PublisherEditDialog extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'md-dialog': MdDialog,
  };

  @property({ type: String })
  name = '';

  @property({ type: String })
  path = '';

  @query('md-dialog')
  private dialog?: MdDialog;

  get open(): boolean {
    return Boolean(this.dialog?.open);
  }

  show(): void {
    this.paintShadow();
    this.dialog?.show();
  }

  close(): void {
    if (this.open) this.dialog?.close();
  }

  override async firstUpdated(): Promise<void> {
    await this.dialog?.updateComplete;
    this.paintShadow();
  }

  private paintShadow(): void {
    const surface = this.dialog?.renderRoot.querySelector('dialog');
    if (!(surface instanceof HTMLElement)) return;
    surface.style.boxShadow = dialogShadow;
  }

  private onClosed(): void {
    this.dispatchEvent(new Event('closed'));
  }

  /** Enter follows the enabled Save button. Other controls keep their own Enter. */
  private onDialogKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.repeat || event.isComposing) return;
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!this.open || !editDialogEnterSaves(event.composedPath())) return;
    const save = this.saveButton();
    if (!save || save.disabled) return;
    event.preventDefault();
    save.click();
  }

  /** The filled button in the actions slot. */
  private saveButton(): (HTMLElement & { disabled?: boolean }) | null {
    const slot = this.renderRoot.querySelector('slot[name="actions"]');
    if (!(slot instanceof HTMLSlotElement)) return null;
    const save = slot
      .assignedElements({ flatten: true })
      .find(element => element.localName === 'md-filled-button');
    return save instanceof HTMLElement ? save : null;
  }

  private visiblePath(): string {
    const path = this.path.trim();
    if (path === '' || path === 'UNDEFINED') return '';
    return path;
  }

  render(): TemplateResult {
    const path = this.visiblePath();
    return html`<md-dialog
      @closed=${() => this.onClosed()}
      @keydown=${(event: KeyboardEvent) => this.onDialogKeydown(event)}
    >
      <div slot="headline" class="headline">
        <span class="headline-name">${this.name}</span>
        ${path ? html`<span class="headline-path">${path}</span>` : ''}
      </div>
      <div slot="content" class="dialog-body">
        <slot></slot>
      </div>
      <div slot="actions" class="dialog-actions">
        <slot name="actions"></slot>
      </div>
    </md-dialog>`;
  }

  static styles = css`
    :host {
      position: absolute;
      width: 0;
      height: 0;
    }

    /* Material's :host caps the dialog at 560px. A type selector loses to it. */
    :host > md-dialog {
      --md-dialog-container-color: var(--oscd-plugin-internal-base2);
      --md-dialog-container-shape: var(--oscd-plugin-internal-shape);
      --md-dialog-headline-color: var(--oscd-plugin-internal-base3);
      --md-dialog-headline-font: var(--oscd-plugin-internal-text-font);
      --md-dialog-headline-size: 22px;
      --md-dialog-headline-weight: 500;
      --md-dialog-supporting-text-color: var(--oscd-plugin-internal-base03);
      --md-dialog-supporting-text-font: var(--oscd-plugin-internal-text-font);
      --md-dialog-supporting-text-size: 14px;
      width: var(--publisher-edit-dialog-width, min(640px, calc(100vw - 48px)));
      max-width: var(
        --publisher-edit-dialog-width,
        min(640px, calc(100vw - 48px))
      );
      max-height: calc(100vh - 48px);
    }

    :host .headline {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      align-self: stretch;
      gap: 0;
      box-sizing: border-box;
      width: 100%;
      margin: 0;
      padding: 11px 24px 11px;
      background: var(--oscd-plugin-internal-base03);
      color: var(--oscd-plugin-internal-base3);
    }

    .headline-name {
      color: var(--oscd-plugin-internal-base3);
      font-family: var(--oscd-plugin-internal-text-font);
      font-size: 20px;
      font-weight: 500;
      line-height: 32px;
    }

    .headline-path {
      color: var(--oscd-plugin-internal-base1);
      font-family: var(--oscd-plugin-internal-text-font);
      font-size: 12px;
      font-weight: 400;
      line-height: 17px;
    }

    :host .dialog-body {
      box-sizing: border-box;
      width: 100%;
      background: var(--oscd-plugin-internal-base2);
      padding: 16px 24px;
    }

    :host .dialog-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      box-sizing: border-box;
      padding: 8px 24px;
      background: var(--oscd-plugin-internal-base3);
    }
  `;
}

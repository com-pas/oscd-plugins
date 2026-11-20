import { css, html, LitElement, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';

import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { MdCheckbox } from '@scopedelement/material-web/checkbox/MdCheckbox.js';
import { MdIcon } from '@scopedelement/material-web/icon/MdIcon.js';

import { publisherFieldRowStyles } from './publisher-field-row.js';

/**
 * Checkbox with the shared lock column.
 * `value` is `'true'`, `'false'`, or `null` while a nullable box is locked.
 * Loading `null` closes the lock. Opening it again reports `'false'`
 * unless a checked value was parked by the lock button.
 * `checkedWhenLocked` draws that parked tick while the lock is closed
 * and reports `'true'` when the lock opens.
 */
export class PublisherCheckbox extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'md-checkbox': MdCheckbox,
    'md-icon': MdIcon,
  };

  @property({ type: Boolean })
  nullable = false;

  /** A closed lock shows a tick. Opening the lock keeps that tick. */
  @property({ type: Boolean })
  checkedWhenLocked = false;

  @property({ type: Boolean })
  disabled = false;

  @property({ type: String })
  label = '';

  @property({ type: String })
  supportingText = '';

  @state()
  private checked = false;

  @state()
  private locked = false;

  @query('md-checkbox')
  private field?: HTMLElement & { checked: boolean };

  /** `null` only while a nullable checkbox is locked. */
  @property({ attribute: false })
  get value(): string | null {
    if (this.nullable && this.locked) return null;
    return this.checked ? 'true' : 'false';
  }

  /** `null` loads a missing attribute: lock closed, box unchecked. */
  set value(next: string | null) {
    if (this.nullable && next === null) {
      this.locked = true;
      this.checked = this.checkedWhenLocked;
      return;
    }
    this.locked = false;
    this.checked = next === 'true';
  }

  reportValidity(): boolean {
    return true;
  }

  /** `checkedWhenLocked` can arrive after `value`, so the tick is applied here too. */
  override updated(): void {
    if (this.checkedWhenLocked && this.locked && !this.checked) this.checked = true;
  }

  private toggleLock(): void {
    this.locked = !this.locked;
    if (this.locked && this.checkedWhenLocked) this.checked = true;
    this.notifyInput();
  }

  /**
   * Material copies the native change, so the event here is not trusted.
   * Setting `checked` does not dispatch that event.
   */
  private onChange(): void {
    if (this.locked || !this.field) return;
    if (this.field.checked === this.checked) return;
    this.checked = this.field.checked;
    this.notifyInput();
  }

  private notifyInput(): void {
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }

  render(): TemplateResult {
    const locked = this.nullable && this.locked;
    const lockLabel = locked ? `Enable ${this.label}` : `Clear ${this.label}`;
    return html`<div class="row">
      <div class="lock-slot" title=${this.nullable ? lockLabel : ''}>
        ${this.nullable
          ? html`<button
              type="button"
              class="lock"
              aria-pressed=${locked ? 'true' : 'false'}
              aria-label=${lockLabel}
              title=${lockLabel}
              ?disabled=${this.disabled}
              @click=${() => this.toggleLock()}
            >
              <md-icon>${locked ? 'lock' : 'lock_open'}</md-icon>
            </button>`
          : ''}
      </div>
      <label class="choice">
        <md-checkbox
          ?checked=${this.checkedWhenLocked ? this.checked : !locked && this.checked}
          ?disabled=${this.disabled || locked}
          @change=${() => this.onChange()}
        ></md-checkbox>
        <span>${this.label}</span>
        ${this.supportingText
          ? html`<span class="support">${this.supportingText}</span>`
          : ''}
      </label>
    </div>`;
  }

  static styles = [
    publisherFieldRowStyles,
    css`
      .choice {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .support {
        color: var(--oscd-plugin-internal-base01);
      }
    `,
  ];
}

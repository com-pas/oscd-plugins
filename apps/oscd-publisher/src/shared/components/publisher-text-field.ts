import { css, html, LitElement, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';

import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { MdIcon } from '@scopedelement/material-web/icon/MdIcon.js';
import { MdOutlinedTextField } from '@scopedelement/material-web/textfield/MdOutlinedTextField.js';

import { MeasuredOutlinedField } from './measured-outlined-field.js';
import { publisherFieldRowStyles } from './publisher-field-row.js';

class MeasuredOutlinedTextField extends MdOutlinedTextField {
  static override scopedElements = {
    'md-outlined-field': MeasuredOutlinedField,
  };
}

/**
 * Outlined text field with a fixed lock column.
 * `nullable` shows the lock. Without it the column stays empty, so every
 * field has the same width. A closed lock reports `null` and shows the
 * label as placeholder. The typed text is kept and comes back when the
 * lock opens. An empty open field is `''`.
 */
export class PublisherTextField extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'md-icon': MdIcon,
    'md-outlined-text-field': MeasuredOutlinedTextField,
  };

  @property({ type: Boolean })
  nullable = false;

  @property({ type: Boolean })
  required = false;

  @property({ type: Boolean })
  disabled = false;

  @property({ type: String })
  label = '';

  @property({ type: String })
  supportingText = '';

  /** Red validation message. Replaces `supportingText` while set. */
  @property({ type: String })
  errorText = '';

  @property({ type: String })
  pattern = '';

  @property({ type: String })
  placeholder = '';

  @property({ type: String })
  suffixText = '';

  @property({ type: String })
  type = 'text';

  /** `-1` means no limit. */
  @property({ type: Number })
  maxLength = -1;

  /** Typed text. Hidden while the lock is closed. */
  @state()
  private text = '';

  /** Closed lock. Only used when `nullable` is set. */
  @state()
  private locked = false;

  @query('md-outlined-text-field')
  private field?: MdOutlinedTextField;

  /** `null` only while a nullable field is locked. */
  @property({ attribute: false })
  get value(): string | null {
    return this.nullable && this.locked ? null : this.text;
  }

  /** `null` loads a missing attribute: lock closed, no parked text. */
  set value(next: string | null) {
    if (this.nullable && next === null) {
      this.locked = true;
      this.text = '';
      return;
    }
    this.locked = false;
    this.text = next ?? '';
    this.writeShownValue();
  }

  reportValidity(): boolean {
    if (this.disabled || (this.nullable && this.locked)) return true;
    this.writeShownValue();
    const field = this.field;
    const input = this.nativeInput();
    // Material copies .value on a later update. Asking before that paints a stuck error.
    if (!field || !input || input.value !== this.text) return true;
    return field.reportValidity();
  }

  /** The text the inner input should show. Empty while a nullable lock is closed. */
  private shownValue(): string {
    return this.nullable && this.locked ? '' : this.text;
  }

  /**
   * Copy the model onto Material and the native input now.
   * A later Material update would otherwise leave the input empty.
   */
  private writeShownValue(): void {
    const shown = this.shownValue();
    const field = this.field;
    if (field && field.value !== shown) field.value = shown;
    const input = this.nativeInput();
    if (input && input.value !== shown) input.value = shown;
  }

  private nativeInput(): HTMLInputElement | HTMLTextAreaElement | null {
    const node = this.field?.renderRoot.querySelector('input, textarea');
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) return node;
    return null;
  }

  private toggleLock(): void {
    this.locked = !this.locked;
    this.notifyInput();
  }

  private onInput(event: Event): void {
    if (!event.isTrusted || this.locked) return;
    this.text = (event.target as { value?: string }).value ?? '';
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
      <md-outlined-text-field
        label=${this.label}
        .value=${live(locked ? '' : this.text)}
        supporting-text=${this.supportingText}
        error-text=${this.errorText}
        ?error=${this.errorText !== ''}
        pattern=${this.pattern}
        placeholder=${this.placeholder}
        suffix-text=${this.suffixText}
        type=${this.type}
        .maxLength=${this.maxLength}
        ?required=${this.required && !locked}
        ?disabled=${this.disabled || locked}
        @input=${(event: Event) => this.onInput(event)}
      ></md-outlined-text-field>
    </div>`;
  }

  static styles = [
    publisherFieldRowStyles,
    css`
    md-outlined-text-field {
      width: 100%;
      min-width: 0;
      --md-outlined-text-field-container-shape: var(--oscd-plugin-internal-shape-extra-small);
      --md-outlined-text-field-input-text-color: var(--oscd-plugin-internal-base03);
      --md-outlined-text-field-label-text-color: var(--oscd-plugin-internal-base01);
      --md-outlined-text-field-outline-color: var(--oscd-plugin-internal-base1);
      --md-outlined-text-field-hover-outline-color: var(--oscd-plugin-internal-base00);
      --md-outlined-text-field-focus-outline-color: var(--oscd-plugin-internal-primary);
      --md-outlined-text-field-caret-color: var(--oscd-plugin-internal-primary);
      --md-outlined-text-field-input-text-font: var(--oscd-plugin-internal-text-font);
      --md-outlined-text-field-input-text-size: 14px;
      --md-outlined-text-field-input-text-line-height: 20px;
      --md-outlined-text-field-label-text-font: var(--oscd-plugin-internal-text-font);
      --md-outlined-text-field-label-text-size: 14px;
      --md-outlined-text-field-label-text-line-height: 20px;
      --md-outlined-text-field-label-text-populated-size: 12px;
      --md-outlined-text-field-label-text-populated-line-height: 16px;
      --md-outlined-text-field-supporting-text-font: var(--oscd-plugin-internal-text-font);
      --md-outlined-text-field-supporting-text-size: 12px;
      --md-outlined-text-field-supporting-text-line-height: 16px;
      --md-outlined-text-field-supporting-text-color: var(--oscd-plugin-internal-base01);
      --md-outlined-text-field-error-supporting-text-color: var(--oscd-plugin-internal-error);
      --md-outlined-text-field-error-focus-supporting-text-color: var(--oscd-plugin-internal-error);
      --md-outlined-text-field-error-hover-supporting-text-color: var(--oscd-plugin-internal-error);
      --md-outlined-text-field-top-space: 11px;
      --md-outlined-text-field-bottom-space: 11px;
    }

    md-outlined-text-field[disabled] {
      border-radius: var(--oscd-plugin-internal-shape-extra-small);
      background: color-mix(in srgb, var(--oscd-plugin-internal-base2) 50%, var(--oscd-plugin-internal-base3));
      --md-outlined-text-field-disabled-input-text-color: var(--oscd-plugin-internal-base01);
      --md-outlined-text-field-disabled-label-text-color: var(--oscd-plugin-internal-base01);
      --md-outlined-text-field-disabled-outline-color: var(--oscd-plugin-internal-base1);
      --md-outlined-text-field-disabled-input-text-opacity: 1;
      --md-outlined-text-field-disabled-label-text-opacity: 1;
      --md-outlined-text-field-disabled-outline-opacity: 1;
    }
  `,
  ];
}

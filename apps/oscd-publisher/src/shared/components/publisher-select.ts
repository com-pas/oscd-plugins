import { css, html, LitElement, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';

import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { MdIcon } from '@scopedelement/material-web/icon/MdIcon.js';
import { MdMenu } from '@scopedelement/material-web/menu/MdMenu.js';
import { MdFilledSelect as MdOutlinedSelect } from '@scopedelement/material-web/select/MdOutlineSelect.js';
import { MdSelectOption } from '@scopedelement/material-web/select/MdSelectOption.js';

import { MeasuredOutlinedField } from './measured-outlined-field.js';
import { publisherFieldRowStyles } from './publisher-field-row.js';

/** Uses the field that skips the hidden-label animation. See measured-outlined-field. */
class MeasuredOutlinedSelect extends MdOutlinedSelect {
  static override scopedElements = {
    'md-outlined-field': MeasuredOutlinedField,
    'md-menu': MdMenu,
  };
}

export interface PublisherSelectOption {
  value: string;
  label: string;
}

/**
 * Outlined select in the shared lock column.
 * `value` is the selected option, or `null` while a nullable select is locked.
 * An open select with no selection is `''` until `required` rejects it.
 */
export class PublisherSelect extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'md-icon': MdIcon,
    'md-outlined-select': MeasuredOutlinedSelect,
    'md-select-option': MdSelectOption,
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

  @property({ attribute: false })
  options: PublisherSelectOption[] = [];

  @state()
  private choice = '';

  @state()
  private locked = false;

  @query('md-outlined-select')
  private field?: HTMLElement & { value: string; reportValidity?: () => boolean };

  /** `null` only while a nullable select is locked. */
  @property({ attribute: false })
  get value(): string | null {
    if (this.nullable && this.locked) return null;
    return this.choice;
  }

  /** `null` loads a missing attribute: lock closed, no parked choice. */
  set value(next: string | null) {
    if (this.nullable && next === null) {
      this.locked = true;
      this.choice = '';
      return;
    }
    this.locked = false;
    this.choice = next ?? '';
  }

  reportValidity(): boolean {
    if (this.nullable && this.locked) return true;
    if (this.required && !this.options.some(option => option.value === this.choice)) {
      return false;
    }
    // Material applies .value on a later update. Asking now paints a stuck error.
    if (!this.field || this.field.value !== this.choice) return true;
    return this.field.reportValidity?.() ?? true;
  }

  override updated(): void {
    if (!this.field) return;
    const next = this.locked ? '' : this.choice;
    if (this.field.value !== next) this.field.value = next;
  }

  private toggleLock(): void {
    this.locked = !this.locked;
    this.notifyInput();
  }

  /**
   * A menu click arrives as `new Event('change')`, which is not trusted.
   * Setting `.value` does not dispatch that event.
   */
  private onChange(): void {
    if (this.locked || !this.field) return;
    const next = this.field.value ?? '';
    if (next === this.choice) return;
    this.choice = next;
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
      <md-outlined-select
        label=${this.label}
        supporting-text=${this.supportingText}
        ?required=${this.required && !locked}
        ?disabled=${this.disabled || locked}
        @change=${() => this.onChange()}
      >
        ${locked ? html`<md-select-option selected></md-select-option>` : ''}
        ${this.options.map(
          option => html`<md-select-option
            value=${option.value}
            ?selected=${!locked && option.value === this.choice}
          >
            <div slot="headline">${option.label}</div>
          </md-select-option>`
        )}
      </md-outlined-select>
    </div>`;
  }

  static styles = [
    publisherFieldRowStyles,
    css`
      md-outlined-select {
        width: 100%;
        min-width: 0;
        --md-outlined-field-outline-color: var(--oscd-plugin-internal-base1);
        --md-outlined-field-focus-outline-color: var(--oscd-plugin-internal-primary);
        --md-outlined-field-input-text-color: var(--oscd-plugin-internal-base03);
        --md-outlined-select-text-field-input-text-size: 14px;
        --md-outlined-select-text-field-input-text-line-height: 20px;
        --md-outlined-select-text-field-label-text-font: var(--oscd-plugin-internal-text-font);
        --md-outlined-select-text-field-label-text-size: 14px;
        --md-outlined-select-text-field-label-text-line-height: 20px;
        --md-outlined-select-text-field-label-text-populated-size: 12px;
        --md-outlined-select-text-field-label-text-populated-line-height: 16px;
        --md-outlined-field-top-space: 11px;
        --md-outlined-field-bottom-space: 11px;
        --md-sys-typescale-body-large-font: var(--oscd-plugin-internal-text-font);
        --md-menu-container-color: var(--oscd-plugin-internal-base3);
        --md-menu-item-label-text-color: var(--oscd-plugin-internal-base03);
        --md-menu-item-selected-label-text-color: var(--oscd-plugin-internal-base03);
        --md-menu-item-selected-container-color: var(--oscd-plugin-internal-base2);
      }

      md-outlined-select[disabled] {
        border-radius: var(--oscd-plugin-internal-shape-extra-small);
        background: color-mix(in srgb, var(--oscd-plugin-internal-base2) 50%, var(--oscd-plugin-internal-base3));
        --md-outlined-select-text-field-disabled-input-text-color: var(--oscd-plugin-internal-base01);
        --md-outlined-select-text-field-disabled-label-text-color: var(--oscd-plugin-internal-base01);
        --md-outlined-select-text-field-disabled-outline-color: var(--oscd-plugin-internal-base1);
        --md-outlined-select-text-field-disabled-input-text-opacity: 1;
        --md-outlined-select-text-field-disabled-label-text-opacity: 1;
        --md-outlined-select-text-field-disabled-outline-opacity: 1;
        --md-outlined-select-text-field-disabled-trailing-icon-color: var(--oscd-plugin-internal-base01);
        --md-outlined-select-text-field-disabled-trailing-icon-opacity: 1;
      }

      md-select-option {
        color: var(--oscd-plugin-internal-base03);
      }
    `,
  ];
}

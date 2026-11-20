import { css, html, LitElement, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';

import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { MdIcon } from '@scopedelement/material-web/icon/MdIcon.js';
import { MdRadio } from '@scopedelement/material-web/radio/MdRadio.js';

import { publisherFieldRowStyles } from './publisher-field-row.js';

export interface PublisherRadioOption {
  value: string;
  label: string;
}

let radioGroupId = 0;

/**
 * One radio group in the shared lock column.
 * `value` is the selected option, or `null` while a nullable group is locked.
 * An open group with no selection is `null`. `required` then fails validity.
 */
export class PublisherRadio extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'md-icon': MdIcon,
    'md-radio': MdRadio,
  };

  @property({ type: Boolean })
  nullable = false;

  @property({ type: Boolean })
  required = false;

  @property({ type: Boolean })
  disabled = false;

  @property({ type: String })
  label = '';

  @property({ attribute: false })
  options: PublisherRadioOption[] = [];

  @state()
  private choice = '';

  @state()
  private locked = false;

  private readonly groupName = `publisher-radio-${++radioGroupId}`;

  /** `null` while locked, or while no option is selected. */
  @property({ attribute: false })
  get value(): string | null {
    if (this.nullable && this.locked) return null;
    return this.choice || null;
  }

  /** `null` loads a missing attribute and closes the lock. */
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
    if (this.required && !this.choice) return false;
    return true;
  }

  private toggleLock(): void {
    this.locked = !this.locked;
    this.notifyInput();
  }

  /**
   * A click or arrow key arrives as `new Event('change')`, which is not trusted.
   * Setting `checked` does not dispatch that event.
   */
  private choose(value: string): void {
    if (this.locked || value === this.choice) return;
    this.choice = value;
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
      <div class="options" role="radiogroup" aria-label=${this.label}>
        ${this.options.map(
          option => html`<label class="option">
            <md-radio
              name=${this.groupName}
              value=${option.value}
              ?checked=${!locked && this.choice === option.value}
              ?disabled=${this.disabled || locked}
              @change=${() => this.choose(option.value)}
            ></md-radio>
            <span>${option.label}</span>
          </label>`
        )}
      </div>
    </div>`;
  }

  static styles = [
    publisherFieldRowStyles,
    css`
      .options {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 20px;
        min-width: 0;
      }

      .option {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      md-radio {
        --md-radio-icon-color: var(--oscd-plugin-internal-primary);
        --md-radio-selected-icon-color: var(--oscd-plugin-internal-primary);
      }
    `,
  ];
}

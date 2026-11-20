import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';

import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { MdFilledButton } from '@scopedelement/material-web/button/MdFilledButton.js';
import { MdOutlinedButton } from '@scopedelement/material-web/button/MdOutlinedButton.js';
import { MdList } from '@scopedelement/material-web/list/MdList.js';
import { MdListItem } from '@scopedelement/material-web/list/MdListItem.js';
import { MdRadio } from '@scopedelement/material-web/radio/MdRadio.js';

import {
  publisherEditCardStyles,
  PublisherEditDialog,
} from './publisher-edit-dialog.js';

/** Why one LDevice cannot be chosen. `null` means the radio stays enabled. */
export type LDeviceBlockReason = (lDevice: Element) => string | null;

/** Asks which LDevice receives a new entry when the IED has more than one. */
export class PublisherLDeviceSelectDialog extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'md-filled-button': MdFilledButton,
    'md-outlined-button': MdOutlinedButton,
    'md-list': MdList,
    'md-list-item': MdListItem,
    'md-radio': MdRadio,
    'publisher-edit-dialog': PublisherEditDialog,
  };

  @property({ attribute: false })
  lDevices: Element[] = [];

  /** SCL path of the IED, shown under the title. */
  @property({ type: String })
  path = '';

  /** Sentence under the title. The caller names the entry being added. */
  @property({ type: String })
  message = '';

  @property({ attribute: false })
  selected: Element | null = null;

  /** Row tooltip. The caller decides which LDevices are disabled. */
  @property({ attribute: false })
  blockReason: LDeviceBlockReason = () => null;

  @query('publisher-edit-dialog')
  private dialog?: PublisherEditDialog;

  show(): void {
    void this.updateComplete.then(() => {
      if (this.lDevices.length === 0) return;
      this.dialog?.show();
    });
  }

  close(): void {
    this.dialog?.close();
  }

  private choose(lDevice: Element): void {
    if (this.blockReason(lDevice)) return;
    this.dispatchEvent(
      new CustomEvent('ldevice-change', {
        detail: lDevice,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private accept(): void {
    if (!this.selected || this.blockReason(this.selected)) return;
    this.dispatchEvent(
      new CustomEvent('ldevice-accept', { bubbles: true, composed: true }),
    );
  }

  render(): TemplateResult {
    return html`<publisher-edit-dialog .name=${'Select LDevice'} .path=${this.path}>
      <section class="card">
        <p>${this.message}</p>
        <form>
          <md-list role="radiogroup">
            ${this.lDevices.map((lDevice, index) => {
              const block = this.blockReason(lDevice);
              const inst = lDevice.getAttribute('inst') ?? '';
              return html`<md-list-item>
                <span
                  class="ldevice-choice"
                  ?data-blocked=${block !== null}
                  title=${block || nothing}
                >
                  <md-radio
                    id=${`ldevice${index}`}
                    name="ldevice"
                    value=${inst}
                    ?disabled=${block !== null}
                    ?checked=${this.selected === lDevice}
                    @change=${() => this.choose(lDevice)}
                  ></md-radio>
                  <label for=${`ldevice${index}`}>${inst}</label>
                </span>
              </md-list-item>`;
            })}
          </md-list>
        </form>
      </section>
      <md-outlined-button slot="actions" @click=${() => this.close()}
        >Cancel</md-outlined-button
      >
      <md-filled-button
        slot="actions"
        class="ldevice select"
        ?disabled=${!this.selected}
        @click=${() => this.accept()}
        >Select</md-filled-button
      >
    </publisher-edit-dialog>`;
  }

  static styles = [
    publisherEditCardStyles,
    css`
      :host {
        position: absolute;
        width: 0;
        height: 0;
      }

      publisher-edit-dialog {
        --publisher-edit-dialog-width: min(640px, calc(100vw - 48px));
      }

      p {
        margin: 0;
        color: var(--oscd-plugin-internal-base03);
        font-size: 14px;
      }

      .ldevice-choice {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .ldevice-choice[data-blocked] {
        cursor: not-allowed;
      }

      .ldevice-choice[data-blocked] md-radio,
      .ldevice-choice[data-blocked] label {
        color: var(--oscd-plugin-internal-base1);
        pointer-events: none;
      }
    `,
  ];
}

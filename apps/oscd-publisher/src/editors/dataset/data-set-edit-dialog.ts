import { css, html, LitElement, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, queryAll, state } from 'lit/decorators.js';

import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

import { MdFilledButton } from '@scopedelement/material-web/button/MdFilledButton.js';
import { MdOutlinedButton } from '@scopedelement/material-web/button/MdOutlinedButton.js';

import { newEditEvent } from '@openenergytools/open-scd-core';
import { identity, updateDataSet } from '@openenergytools/scl-lib';

import { pathIdentity } from '../../foundation.js';
import {
  publisherEditCardStyles,
  PublisherEditDialog,
} from '../../shared/components/publisher-edit-dialog.js';
import { PublisherTextField } from '../../shared/components/publisher-text-field.js';
import { dataSetNameTaken } from './data-set-name.js';

/** Name and description editor for one DataSet. */
export class DataSetEditDialog extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'md-filled-button': MdFilledButton,
    'md-outlined-button': MdOutlinedButton,
    'publisher-edit-dialog': PublisherEditDialog,
    'publisher-text-field': PublisherTextField,
  };

  @property({ attribute: false })
  element: Element | null = null;

  /** The element is not in the document yet. Add inserts it. */
  @property({ type: Boolean })
  creating = false;

  /** Header path while `creating`. The detached node has no parent. */
  @property({ type: String })
  createPath = '';

  /** LN that will own the DataSet while creating. The node is still detached. */
  @property({ attribute: false })
  nameParent: Element | null = null;

  @state()
  private someDiffOnInputs = false;

  @state()
  private addEnabled = false;

  @state()
  private nameMessage = '';

  private savedEdit = false;

  @queryAll('publisher-text-field') inputs!: NodeListOf<PublisherTextField>;

  @query('.dataset.save') saveButton!: MdFilledButton;

  @query('.dataset.name') private nameInput!: PublisherTextField;

  @query('.dataset.desc') private descInput!: PublisherTextField;

  @query('publisher-edit-dialog') private dialog?: PublisherEditDialog;

  public show(): void {
    void this.openWhenReady();
  }

  public close(): void {
    if (this.dialog?.open) this.dialog.close();
  }

  /** The dialog's first render can land after the pencil click. */
  private async openWhenReady(): Promise<void> {
    await this.updateComplete;
    if (!this.element) return;
    this.syncInputsFromElement();
    this.someDiffOnInputs = false;
    this.nameMessage = '';
    await this.nameInput?.updateComplete;
    // Clear a stale required message before the dialog focuses the name field.
    this.applyNameState();
    this.dialog?.show();
    requestAnimationFrame(() => {
      if (this.isConnected) this.applyNameState();
    });
  }

  onInputChange(): void {
    if (!this.element || !this.nameInput || !this.descInput) return;

    this.someDiffOnInputs =
      (this.element.getAttribute('name') ?? '') !== this.nameInput.value ||
      (this.element.getAttribute('desc') ?? null) !== this.descInput.value;
    this.applyNameState();
  }

  override willUpdate(changed: PropertyValues): void {
    if (!this.inputsChanged(changed)) return;
    // Reset before render. Assigning these in updated() schedules another update.
    if (this.someDiffOnInputs) this.someDiffOnInputs = false;
    if (!this.creating && this.addEnabled) this.addEnabled = false;
    if (this.nameMessage) this.nameMessage = '';
  }

  override updated(changed: PropertyValues): void {
    if (!this.inputsChanged(changed)) return;
    this.syncInputsFromElement();
    void this.nameInput?.updateComplete.then(() => this.applyNameState());
  }

  private inputsChanged(changed: PropertyValues): boolean {
    return changed.has('element') || changed.has('creating');
  }

  /** LN whose direct DataSet children must keep unique names. */
  private nameScope(): Element | null {
    if (this.creating) return this.nameParent;
    return this.element?.parentElement ?? null;
  }

  /** Enables Add or Save only for a filled, unused name. */
  private applyNameState(): void {
    const name = this.nameInput?.value ?? '';
    const taken = dataSetNameTaken(
      this.nameScope(),
      name,
      this.creating ? null : this.element,
    );
    const message = taken ? 'DataSet already exists' : '';
    if (message !== this.nameMessage) this.nameMessage = message;
    // A filled name clears a stale required message, including before show().
    if (this.nameInput && (name !== '' || this.dialog?.open)) {
      this.nameInput.reportValidity();
    }
    const enabled =
      name !== '' && !taken && (this.creating || this.someDiffOnInputs);
    if (enabled !== this.addEnabled) this.addEnabled = enabled;
  }

  private syncInputsFromElement(): void {
    if (!this.nameInput || !this.descInput) return;
    this.nameInput.value = this.element?.getAttribute('name') ?? '';
    this.descInput.value = this.element?.getAttribute('desc') ?? null;
  }

  private onClosed(): void {
    if (this.savedEdit) {
      this.savedEdit = false;
      return;
    }
    if (this.creating) {
      this.dispatchEvent(
        new CustomEvent('create-cancel', { bubbles: true, composed: true }),
      );
    }
    this.syncInputsFromElement();
    this.someDiffOnInputs = false;
    this.nameMessage = '';
    this.addEnabled = false;
    if ((this.nameInput?.value ?? '') !== '') this.nameInput?.reportValidity();
  }

  /** Copy the form onto the detached DataSet. `updateDataSet` needs a parent. */
  private writeCreateAttributes(): void {
    const element = this.element;
    if (!element || !this.nameInput || !this.descInput) return;
    const name = this.nameInput.value ?? '';
    if (name) element.setAttribute('name', name);
    const desc = this.descInput.value;
    if (desc) element.setAttribute('desc', desc);
    else element.removeAttribute('desc');
  }

  private saveChanges(): void {
    if (!this.element || !this.nameInput || !this.descInput || !this.addEnabled) return;
    const name = this.nameInput.value ?? '';
    if (
      name === '' ||
      dataSetNameTaken(this.nameScope(), name, this.creating ? null : this.element)
    ) {
      return;
    }

    if (this.creating) {
      this.writeCreateAttributes();
      this.savedEdit = true;
      this.dispatchEvent(
        new CustomEvent('create-accept', { bubbles: true, composed: true }),
      );
      this.dialog?.close();
      return;
    }

    const attributes: Record<string, string | null> = {};
    const desc = this.descInput.value;
    if ((this.element.getAttribute('name') ?? '') !== name) attributes.name = name;
    if ((this.element.getAttribute('desc') ?? null) !== desc) attributes.desc = desc;

    if (Object.keys(attributes).length > 0) {
      this.dispatchEvent(
        newEditEvent(updateDataSet({ element: this.element, attributes }), {
          title: `Update DataSet ${identity(this.element)}`,
        })
      );
    }

    this.someDiffOnInputs = false;
    if (this.dialog?.open) {
      this.savedEdit = true;
      this.dialog.close();
    }
  }

  render(): TemplateResult {
    const name = this.element?.getAttribute('name') ?? 'DataSet';
    const path =
      this.creating && this.createPath
        ? this.createPath
        : this.element
          ? pathIdentity(this.element)
          : '';

    return html`<publisher-edit-dialog
      .name=${name}
      .path=${path}
      @closed=${() => this.onClosed()}
    >
      <section class="card">
        <h3>General</h3>
        <publisher-text-field
          class="dataset name"
          label="Name"
          required
          .errorText=${this.nameMessage}
          @input=${() => this.onInputChange()}
        ></publisher-text-field>
        <publisher-text-field
          class="dataset desc"
          label="Description"
          nullable
          @input=${() => this.onInputChange()}
        ></publisher-text-field>
      </section>
      <md-outlined-button slot="actions" @click=${() => this.dialog?.close()}
        >Cancel</md-outlined-button
      >
      <md-filled-button
        slot="actions"
        class="dataset save"
        ?disabled=${!this.addEnabled}
        @click=${() => this.saveChanges()}
        >${this.creating ? 'Add' : 'Save changes'}</md-filled-button
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

      publisher-text-field {
        display: block;
        width: 100%;
      }
    `,
  ];
}

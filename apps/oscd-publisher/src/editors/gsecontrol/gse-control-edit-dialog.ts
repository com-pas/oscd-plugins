import {
  css,
  html,
  LitElement,
  nothing,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { property, query, state } from 'lit/decorators.js';

import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { MdFilledButton } from '@scopedelement/material-web/button/MdFilledButton.js';
import { MdIcon } from '@scopedelement/material-web/icon/MdIcon.js';
import { MdOutlinedButton } from '@scopedelement/material-web/button/MdOutlinedButton.js';

import { newEditEvent } from '@openenergytools/open-scd-core';
import {
  changeGSEContent,
  type ChangeGSEContentOptions,
  controlBlockGseOrSmv,
  identity,
  updateGSEControl,
} from '@openenergytools/scl-lib';

import {
  dataSetLinkLocked,
  subscribedDataSetTitle,
} from '../dataset-link-lock.js';
import { pathIdentity } from '../../foundation.js';
import { maxLength, patterns, typePattern } from '../../foundation/pattern.js';
import { checkGSEDiff } from '../../foundation/utils/gse.js';
import { PublisherCheckbox } from '../../shared/components/publisher-checkbox.js';
import {
  publisherEditCardStyles,
  PublisherEditDialog,
} from '../../shared/components/publisher-edit-dialog.js';
import {
  PublisherRadio,
  type PublisherRadioOption,
} from '../../shared/components/publisher-radio.js';
import {
  PublisherSelect,
  type PublisherSelectOption,
} from '../../shared/components/publisher-select.js';
import { PublisherTextField } from '../../shared/components/publisher-text-field.js';

const typeOptions: PublisherRadioOption[] = [
  { value: 'GOOSE', label: 'GOOSE' },
  { value: 'GSSE', label: 'GSSE' },
];

const securityOptions: PublisherRadioOption[] = [
  { value: 'None', label: 'None' },
  { value: 'Signature', label: 'Signature only' },
  { value: 'SignatureAndEncryption', label: 'Signature & encryption' },
];

const vlanPriorityOptions: PublisherSelectOption[] = ['0', '1', '2', '3', '4', '5', '6', '7'].map(
  value => ({ value, label: value }),
);

const addressHelp: Record<string, string> = {
  'MAC-Address': 'MAC address (01-0C-CD-01-xx-xx)',
  APPID: 'APP ID (4 hex values)',
  'VLAN-ID': 'VLAN ID (3 hex value)',
  'VLAN-PRIORITY': 'VLAN Priority (0-7)',
};

/** Pause before the dialog title follows the name field. */
const titleDebounceMs = 200;

/** Edits one GSEControl and its communication settings. The linked DataSet is read-only. */
export class GseControlEditDialog extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'md-filled-button': MdFilledButton,
    'publisher-edit-dialog': PublisherEditDialog,
    'md-icon': MdIcon,
    'md-outlined-button': MdOutlinedButton,
    'publisher-checkbox': PublisherCheckbox,
    'publisher-radio': PublisherRadio,
    'publisher-select': PublisherSelect,
    'publisher-text-field': PublisherTextField,
  };

  /** GSEControl being edited. */
  @property({ attribute: false })
  control: Element | null = null;

  /** Linked DataSet stored on the control. A staged pick replaces it only on save. */
  @property({ attribute: false })
  dataSet: Element | null = null;

  /** DataSet chosen in this dialog. Unset until Change data set picks one. */
  @state()
  private stagedDataSet?: Element;

  /** SCL change indicator. A new count reloads the fields. */
  @property({ type: Number })
  editCount = -1;

  /** The control is not in the document yet. Add inserts it. */
  @property({ type: Boolean })
  creating = false;

  /** GSE scl-lib built with the new control. The live lookup cannot see it. */
  @property({ attribute: false })
  pendingGse: Element | null = null;

  /** Header path while `creating`. The detached control has no parent. */
  @property({ type: String })
  createPath = '';

  @state()
  private canSave = false;

  /** Name shown in the header. `null` while no control is loaded. */
  @state()
  private titleName: string | null = null;

  private savedEdit = false;

  /** Browser timer id. DOM `setTimeout` returns a number, not Node's `Timeout`. */
  private titleTimer: number | undefined;

  @query('publisher-edit-dialog') private dialog?: PublisherEditDialog;

  @query('.control.name') private nameField?: PublisherTextField;
  @query('.control.desc') private descField?: PublisherTextField;
  @query('.control.app-id') private appIdField?: PublisherTextField;
  @query('.control.conf-rev') private confRevField?: PublisherTextField;
  @query('.control.fixed-offs') private fixedOffsField?: PublisherCheckbox;
  @query('.control.type') private typeField?: PublisherRadio;
  @query('.control.security') private securityField?: PublisherRadio;
  @query('.dataset.name') private datasetNameField?: PublisherTextField;
  @query('.dataset.desc') private datasetDescField?: PublisherTextField;
  @query('.gse.inst-type') private instTypeField?: PublisherCheckbox;
  @query('.gse.mac') private macField?: PublisherTextField;
  @query('.gse.app-id') private appIdCommField?: PublisherTextField;
  @query('.gse.vlan-id') private vlanIdField?: PublisherTextField;
  @query('.gse.vlan-priority') private vlanPriorityField?: PublisherSelect;
  @query('.gse.min-time') private minTimeField?: PublisherTextField;
  @query('.gse.max-time') private maxTimeField?: PublisherTextField;

  public async show(): Promise<void> {
    await this.updateComplete;
    if (!this.control) return;
    await this.resync();
    this.dialog?.show();
  }

  public close(): void {
    if (this.dialog?.open) this.dialog.close();
  }

  /** Shows this DataSet in the gray fields. Save writes the link. */
  stageDataSet(dataSet: Element): void {
    this.stagedDataSet = dataSet;
  }

  override willUpdate(changed: PropertyValues): void {
    if (!this.hostInputsChanged(changed)) return;
    // Set before render. The empty name field is not a title while no control is loaded.
    const next = this.control ? (this.control.getAttribute('name') ?? '') : null;
    if (next !== this.titleName) this.titleName = next;
  }

  override updated(changed: PropertyValues): void {
    if (this.hostInputsChanged(changed)) {
      void this.resync();
      return;
    }
    if (changed.has('stagedDataSet')) {
      this.syncDatasetFields();
      this.refreshState();
    }
  }

  override disconnectedCallback(): void {
    this.clearTitleTimer();
    super.disconnectedCallback();
  }

  private get gse(): Element | null {
    if (this.creating && this.pendingGse) return this.pendingGse;
    return this.control ? controlBlockGseOrSmv(this.control) : null;
  }

  /** Field setters do not wait for the inner control to render. */
  private async resync(): Promise<void> {
    this.clearTitleTimer();
    this.stagedDataSet = undefined;
    this.syncFromElements();
    this.publishTitle();
    const fields = Array.from(
      this.renderRoot.querySelectorAll(
        'publisher-text-field, publisher-radio, publisher-select, publisher-checkbox',
      ),
    ) as LitElement[];
    await Promise.all(fields.map(field => field.updateComplete));
    this.publishTitle();
    this.refreshState();
  }

  private hostInputsChanged(changed: PropertyValues): boolean {
    return (
      changed.has('control') ||
      changed.has('dataSet') ||
      changed.has('pendingGse') ||
      (changed.has('editCount') && !this.creating)
    );
  }

  private readTitleName(): string | null {
    if (!this.control) return null;
    const value = this.nameField?.value;
    if (typeof value === 'string') return value;
    return this.control.getAttribute('name') ?? '';
  }

  private publishTitle(): void {
    const next = this.readTitleName();
    if (next !== this.titleName) this.titleName = next;
  }

  private clearTitleTimer(): void {
    if (this.titleTimer === undefined) return;
    window.clearTimeout(this.titleTimer);
    this.titleTimer = undefined;
  }

  /** The header follows the name field once typing pauses. */
  private scheduleTitle(): void {
    this.clearTitleTimer();
    this.titleTimer = window.setTimeout(() => {
      this.titleTimer = undefined;
      this.publishTitle();
    }, titleDebounceMs);
  }

  private onFormInput(event: Event): void {
    this.refreshState();
    const nameField = this.nameField;
    if (nameField && event.composedPath().includes(nameField)) {
      this.scheduleTitle();
    }
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
    void this.resync();
  }

  private requestDatasetChange(): void {
    if (dataSetLinkLocked(this.control)) return;
    this.dispatchEvent(
      new Event('change-dataset', { bubbles: true, composed: true }),
    );
  }

  /** Empty text and a closed lock both mean the attribute is absent. */
  private stored(value: string | null | undefined): string | null {
    return value ? value : null;
  }

  private syncFromElements(): void {
    const control = this.control;
    const nameField = this.nameField;
    const descField = this.descField;
    const appIdField = this.appIdField;
    const confRevField = this.confRevField;
    const fixedOffsField = this.fixedOffsField;
    const typeField = this.typeField;
    const securityField = this.securityField;
    if (
      !control ||
      !nameField ||
      !descField ||
      !appIdField ||
      !confRevField ||
      !fixedOffsField ||
      !typeField ||
      !securityField
    ) {
      return;
    }

    nameField.value = control.getAttribute('name') ?? '';
    descField.value = control.getAttribute('desc');
    appIdField.value = control.getAttribute('appID') ?? '';
    confRevField.value = control.getAttribute('confRev');
    fixedOffsField.value = control.getAttribute('fixedOffs');
    typeField.value = control.getAttribute('type');
    securityField.value = control.getAttribute('securityEnabled');

    this.syncDatasetFields();

    const gse = this.gse;
    const macField = this.macField;
    const appIdCommField = this.appIdCommField;
    const vlanIdField = this.vlanIdField;
    const vlanPriorityField = this.vlanPriorityField;
    const minTimeField = this.minTimeField;
    const maxTimeField = this.maxTimeField;
    const instTypeField = this.instTypeField;
    if (
      !gse ||
      !macField ||
      !appIdCommField ||
      !vlanIdField ||
      !vlanPriorityField ||
      !minTimeField ||
      !maxTimeField ||
      !instTypeField
    ) {
      return;
    }

    const address = (key: string): string | null =>
      Array.from(gse.querySelectorAll(':scope > Address > P'))
        .find(item => item.getAttribute('type') === key)
        ?.textContent?.trim() ?? null;

    macField.value = address('MAC-Address') ?? '';
    appIdCommField.value = address('APPID') ?? '';
    vlanIdField.value = address('VLAN-ID');
    vlanPriorityField.value = address('VLAN-PRIORITY');
    minTimeField.value = gse.querySelector(':scope > MinTime')?.textContent?.trim() ?? null;
    maxTimeField.value = gse.querySelector(':scope > MaxTime')?.textContent?.trim() ?? null;
    const hasInstType = Array.from(gse.querySelectorAll(':scope > Address > P')).some(item =>
      item.hasAttribute('xsi:type'),
    );
    instTypeField.value = hasInstType ? 'true' : 'false';
  }

  private controlChanges(): Record<string, string | null> {
    const control = this.control;
    if (!control || !this.nameField) return {};

    const next: Record<string, string | null> = {
      name: this.nameField.value ?? '',
      desc: this.stored(this.descField?.value),
      type: this.stored(this.typeField?.value),
      confRev: this.stored(this.confRevField?.value),
      appID: this.appIdField?.value ?? '',
      fixedOffs: this.stored(this.fixedOffsField?.value),
      securityEnabled: this.stored(this.securityField?.value),
    };
    const attributes: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(next)) {
      const old =
        key === 'name' || key === 'appID'
          ? (control.getAttribute(key) ?? '')
          : this.stored(control.getAttribute(key));
      if (old !== value) attributes[key] = value;
    }
    return attributes;
  }

  /**
   * Staged pick wins. Otherwise the control's datSet.
   * The dataSet property stays stale across editCount.
   */
  private shownDataSet(): Element | null {
    if (this.stagedDataSet) return this.stagedDataSet;
    const name = this.control?.getAttribute('datSet');
    if (!name) return null;
    return (
      this.control?.parentElement?.querySelector(`DataSet[name="${name}"]`) ??
      null
    );
  }

  private syncDatasetFields(): void {
    const shown = this.shownDataSet();
    if (this.datasetNameField) {
      this.datasetNameField.value = shown?.getAttribute('name') ?? 'No DataSet connected';
    }
    if (this.datasetDescField) {
      this.datasetDescField.value = shown?.getAttribute('desc') ?? '';
    }
  }

  private datasetLinkChanged(): boolean {
    const next = this.stagedDataSet?.getAttribute('name');
    if (!next || !this.control) return false;
    return next !== this.control.getAttribute('datSet');
  }

  private communicationChanged(): boolean {
    const gse = this.gse;
    if (!gse || !this.macField) return false;
    return checkGSEDiff(
      gse,
      {
        'MAC-Address': this.stored(this.macField.value),
        APPID: this.stored(this.appIdCommField?.value),
        'VLAN-ID': this.stored(this.vlanIdField?.value),
        'VLAN-PRIORITY': this.stored(this.vlanPriorityField?.value),
        MinTime: this.stored(this.minTimeField?.value),
        MaxTime: this.stored(this.maxTimeField?.value),
      },
      this.instTypeField?.value === 'true',
    );
  }

  private hasChanges(): boolean {
    return (
      Object.keys(this.controlChanges()).length > 0 ||
      this.datasetLinkChanged() ||
      this.communicationChanged()
    );
  }

  private refreshState(): void {
    const fields = Array.from(
      this.renderRoot.querySelectorAll(
        'publisher-text-field, publisher-radio, publisher-select, publisher-checkbox',
      ),
    ) as Array<{ reportValidity?: () => boolean }>;
    const valid = fields.every(field => field.reportValidity?.() !== false);
    this.canSave = valid && (this.creating || this.hasChanges());
  }

  private collectEdits(control: Element) {
    const edits = [];
    const attributes = this.controlChanges();
    if (Object.keys(attributes).length > 0) {
      if (this.creating && attributes.name && this.pendingGse) {
        this.pendingGse.setAttribute('cbName', attributes.name);
      }
      edits.push(...updateGSEControl({ element: control, attributes }));
    }
    if (this.datasetLinkChanged()) {
      edits.push({
        element: control,
        attributes: { datSet: this.stagedDataSet?.getAttribute('name') ?? '' },
      });
    }

    const gse = this.gse;
    if (gse && this.communicationChanged()) {
      const address: NonNullable<ChangeGSEContentOptions['address']> = {
        instType: this.instTypeField?.value === 'true',
      };
      const timing: NonNullable<ChangeGSEContentOptions['timing']> = {};
      const mac = this.macField?.value;
      const appId = this.appIdCommField?.value;
      const vlanId = this.vlanIdField?.value;
      const vlanPriority = this.vlanPriorityField?.value;
      const minTime = this.minTimeField?.value;
      const maxTime = this.maxTimeField?.value;
      if (mac) address.mac = mac;
      if (appId) address.appId = appId;
      if (vlanId) address.vlanId = vlanId;
      if (vlanPriority) address.vlanPriority = vlanPriority;
      if (minTime) timing.MinTime = minTime;
      if (maxTime) timing.MaxTime = maxTime;
      edits.push(...changeGSEContent(gse, { address, timing }));
    }
    return edits;
  }

  private saveChanges(): void {
    const control = this.control;
    if (!control || !this.canSave) return;

    const edits = this.collectEdits(control);
    if (this.creating) {
      this.savedEdit = true;
      this.dispatchEvent(
        new CustomEvent('create-accept', {
          detail: { edits },
          bubbles: true,
          composed: true,
        }),
      );
      this.canSave = false;
      this.dialog?.close();
      return;
    }

    if (edits.length === 0) return;

    this.dispatchEvent(
      newEditEvent(edits, { title: `Update GSEControl ${identity(control)}` }),
    );
    this.canSave = false;
    if (this.dialog?.open) {
      this.savedEdit = true;
      this.dialog.close();
    }
  }

  render(): TemplateResult {
    const name = this.titleName ?? this.control?.getAttribute('name') ?? 'GSEControl';
    const path =
      this.creating && this.createPath
        ? this.createPath
        : this.control
          ? pathIdentity(this.control)
          : '';
    const datasetLocked = dataSetLinkLocked(this.control);

    return html`<publisher-edit-dialog
      .name=${name}
      .path=${path}
      @closed=${() => this.onClosed()}
    >
      <div class="edit-grid" @input=${(event: Event) => this.onFormInput(event)}>
        <div class="column">
          <section class="card">
            <h3>General</h3>
            <publisher-text-field
              class="control name"
              label="Name"
              required
              pattern=${patterns.asciName}
              .maxLength=${maxLength.cbName}
            ></publisher-text-field>
            <publisher-text-field
              class="control desc"
              label="Description"
              nullable
            ></publisher-text-field>
            <publisher-text-field
              class="control app-id"
              label="GSEControl ID"
              required
            ></publisher-text-field>
            <publisher-text-field
              class="control conf-rev"
              label="Configuration Revision"
              nullable
              pattern=${patterns.unsigned}
            ></publisher-text-field>
            <publisher-checkbox
              class="control fixed-offs"
              label="Fixed Offs"
              nullable
              supportingText="Whether ASN.1 coding is done with fixed offsets"
            ></publisher-checkbox>
          </section>
          <section class="card">
            <h3>Type</h3>
            <publisher-radio
              class="control type"
              label="Type"
              nullable
              required
              .options=${typeOptions}
            ></publisher-radio>
          </section>
          <section class="card">
            <h3>Security</h3>
            <publisher-radio
              class="control security"
              label="Security"
              nullable
              required
              .options=${securityOptions}
            ></publisher-radio>
          </section>
        </div>
        <div class="column">
          <section class="card">
            <h3>Connected data set</h3>
            <div class="dataset-line">
              <publisher-text-field
                class="dataset name"
                label="Data set"
                disabled
              ></publisher-text-field>
              <span
                class="dataset-lock"
                title=${datasetLocked ? subscribedDataSetTitle : nothing}
              >
                <md-outlined-button
                  class="change dataset"
                  ?disabled=${datasetLocked}
                  aria-label=${datasetLocked ? subscribedDataSetTitle : nothing}
                  @click=${() => this.requestDatasetChange()}
                >
                  <md-icon slot="icon">link</md-icon>
                  Change data set
                </md-outlined-button>
              </span>
            </div>
            ${this.shownDataSet()
              ? html`<publisher-text-field
                  class="dataset desc"
                  label="Description"
                  disabled
                ></publisher-text-field>`
              : ''}
          </section>
          <section class="card">
            <h3>Communication settings</h3>
            ${this.gse
              ? html`<publisher-checkbox
                    class="gse inst-type"
                    label="Add XML Schema-instance type"
                  ></publisher-checkbox>
                  <publisher-text-field
                    class="gse mac"
                    label="MAC-Address"
                    required
                    placeholder="01-0C-CD-01-xx-xx"
                    pattern=${typePattern['MAC-Address'] ?? ''}
                    supportingText=${addressHelp['MAC-Address']}
                  ></publisher-text-field>
                  <publisher-text-field
                    class="gse app-id"
                    label="App ID"
                    required
                    placeholder="0000"
                    pattern=${typePattern.APPID ?? ''}
                    supportingText=${addressHelp.APPID}
                  ></publisher-text-field>
                  <publisher-text-field
                    class="gse vlan-id"
                    label="VLAN ID"
                    nullable
                    required
                    placeholder="000"
                    pattern=${typePattern['VLAN-ID'] ?? ''}
                    supportingText=${addressHelp['VLAN-ID']}
                  ></publisher-text-field>
                  <publisher-select
                    class="gse vlan-priority"
                    label="VLAN priority"
                    nullable
                    required
                    supportingText=${addressHelp['VLAN-PRIORITY']}
                    .options=${vlanPriorityOptions}
                  ></publisher-select>
                  <publisher-text-field
                    class="gse min-time"
                    label="Min time"
                    nullable
                    type="number"
                    suffixText="ms"
                    supportingText="Min repetition interval"
                  ></publisher-text-field>
                  <publisher-text-field
                    class="gse max-time"
                    label="Max time"
                    nullable
                    type="number"
                    suffixText="ms"
                    supportingText="Max repetition interval"
                  ></publisher-text-field>`
              : html`<p class="empty">No connection to SubNetwork</p>`}
          </section>
        </div>
      </div>
      <md-outlined-button slot="actions" @click=${() => this.dialog?.close()}
        >Cancel</md-outlined-button
      >
      <md-filled-button
        slot="actions"
        class="gse save"
        ?disabled=${!this.canSave}
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
      --publisher-edit-dialog-width: min(1200px, calc(100vw - 48px));
    }

    .edit-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 16px;
      box-sizing: border-box;
      width: 100%;
    }

    .column {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }

    .dataset-line {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
    }

    .empty {
      margin: 0;
      color: var(--oscd-plugin-internal-base01);
    }

    @media (max-width: 800px) {
      .edit-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
  ];
}

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
  changeSMVContent,
  type ChangeGseOrSmvAddressOptions,
  controlBlockGseOrSmv,
  createSMV,
  identity,
  updateSampledValueControl,
} from '@openenergytools/scl-lib';

import {
  dataSetLinkLocked,
  subscribedDataSetTitle,
} from '../dataset-link-lock.js';
import { pathIdentity } from '../../foundation.js';
import { maxLength, patterns, typePattern } from '../../foundation/pattern.js';
import { checkSMVDiff } from '../../foundation/utils/smv.js';
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

const sampleModeOptions: PublisherRadioOption[] = [
  { value: 'SmpPerPeriod', label: 'Sampled per Period' },
  { value: 'SmpPerSec', label: 'Samples per Second' },
  { value: 'SecPerSmp', label: 'Seconds per Sample' },
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
  'MAC-Address': 'MAC address (01-0C-CD-04-xx-xx)',
  APPID: 'APP ID (4xxx in hex)',
  'VLAN-ID': 'VLAN ID (XXX in hex)',
  'VLAN-PRIORITY': 'VLAN Priority (0-7)',
};

const smvOptHelp: Record<string, string> = {
  refreshTime: 'SMV stream includes refresh time',
  sampleSynchronized: 'SMV stream includes synchronized information',
  sampleRate: 'SMV streams includes sampled rate information',
  dataSet: 'SMV streams includes data set reference',
  security: 'SMV streams includes security setting',
  timestamp: 'SMV streams includes time stamp information',
  synchSourceId: 'SMV streams includes synchronization source',
};

/** Pause before the dialog title follows the name field. */
const titleDebounceMs = 200;

/** Address fields kept while multicast is switched off in this dialog. */
type AddressMemory = {
  mac: string;
  appId: string;
  vlanId: string | null;
  vlanPriority: string | null;
  instType: boolean;
};

/** Edits one SampledValueControl, its SmvOpts, and its SMV address. */
export class SampledValueControlEditDialog extends ScopedElementsMixin(LitElement) {
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

  /** SampledValueControl being edited. */
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

  private _creating = false;

  /** The control is not in the document yet. Add inserts it. */
  @property({ type: Boolean })
  get creating(): boolean {
    return this._creating;
  }

  set creating(next: boolean) {
    if (next === this._creating) return;
    const old = this._creating;
    this._creating = next;
    this.requestUpdate('creating', old);
  }

  /** SMV scl-lib built with the new control. The live lookup cannot see it. */
  @property({ attribute: false })
  pendingSmv: Element | null = null;

  /** Header path while `creating`. The detached control has no parent. */
  @property({ type: String })
  createPath = '';

  /**
   * Locked or checked. Unchecked hides the address.
   * A missing attribute and `multicast="true"` are on.
   */
  @state()
  private multicastOn = true;

  /** Address typed in this dialog, restored if multicast is turned back on. */
  private addressMemory: AddressMemory | null = null;

  /** SMV built for a saved control that has none yet. Inserted on save. */
  @state()
  private draftedSmv: Element | null = null;

  private draftInsert: ReturnType<typeof createSMV> = null;

  /** Drops an address reload that a newer multicast change replaced. */
  private multicastGeneration = 0;

  @state()
  private canSave = false;

  /** Name shown in the header. `null` until the field has been read. */
  @state()
  private titleName: string | null = null;

  private savedEdit = false;

  /** Drops a reload that a newer one has already replaced. */
  private resyncGeneration = 0;

  /** Browser timer id. DOM `setTimeout` returns a number, not Node's `Timeout`. */
  private titleTimer: number | undefined;

  @query('publisher-edit-dialog') private dialog?: PublisherEditDialog;

  @query('.control.name') private nameField?: PublisherTextField;
  @query('.control.desc') private descField?: PublisherTextField;
  @query('.control.multicast') private multicastField?: PublisherCheckbox;
  @query('.control.conf-rev') private confRevField?: PublisherTextField;
  @query('.control.smv-id') private smvIdField?: PublisherTextField;
  @query('.control.sample-mode') private smpModField?: PublisherRadio;
  @query('.control.smp-rate') private smpRateField?: PublisherTextField;
  @query('.control.nof-asdu') private nofAsduField?: PublisherTextField;
  @query('.control.security') private securityField?: PublisherRadio;
  @query('.dataset.name') private datasetNameField?: PublisherTextField;
  @query('.dataset.desc') private datasetDescField?: PublisherTextField;
  @query('.opt.refresh-time') private refreshTimeField?: PublisherCheckbox;
  @query('.opt.sample-synchronized') private sampleSynchronizedField?: PublisherCheckbox;
  @query('.opt.sample-rate') private sampleRateOptField?: PublisherCheckbox;
  @query('.opt.data-set') private dataSetOptField?: PublisherCheckbox;
  @query('.opt.security') private securityOptField?: PublisherCheckbox;
  @query('.opt.timestamp') private timestampField?: PublisherCheckbox;
  @query('.opt.synch-source') private synchSourceField?: PublisherCheckbox;
  @query('.comm.inst-type') private instTypeField?: PublisherCheckbox;
  @query('.comm.mac') private macField?: PublisherTextField;
  @query('.comm.app-id') private appIdField?: PublisherTextField;
  @query('.comm.vlan-id') private vlanIdField?: PublisherTextField;
  @query('.comm.vlan-priority') private vlanPriorityField?: PublisherSelect;

  /** Bumps when a new show replaces a dialog that is still closing. */
  private openGeneration = 0;

  public async show(): Promise<void> {
    const generation = ++this.openGeneration;
    await this.updateComplete;
    if (!this.control) return;
    await this.resync();
    if (generation !== this.openGeneration) return;
    const dialog = this.dialog;
    const onClosed = (): void => {
      dialog?.removeEventListener('closed', onClosed);
      if (generation !== this.openGeneration) return;
      this.finishClose();
    };
    dialog?.addEventListener('closed', onClosed);
    dialog?.show();
  }

  public close(): void {
    if (this.dialog?.open) this.dialog.close();
  }

  /** Shows this DataSet in the gray fields. Save writes the link. */
  stageDataSet(dataSet: Element): void {
    this.stagedDataSet = dataSet;
  }

  override updated(changed: PropertyValues): void {
    const reload =
      changed.has('control') ||
      changed.has('dataSet') ||
      changed.has('pendingSmv') ||
      (changed.has('editCount') && !this.creating);
    if (reload) {
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

  private get smv(): Element | null {
    if (!this.multicastOn) return null;
    if (this.creating) return this.pendingSmv;
    return this.liveSmv() ?? this.draftedSmv;
  }

  /** Missing and `true` show the address. Only `false` hides it. */
  private multicastFromControl(): boolean {
    return (this.control?.getAttribute('multicast') ?? 'true') !== 'false';
  }

  private liveSmv(): Element | null {
    if (this.creating || !this.control) return null;
    return controlBlockGseOrSmv(this.control);
  }

  /** ConnectedAP for this control, using the same lookup as scl-lib. */
  private connectedApOf(control: Element): Element | null {
    const apName = control.closest('AccessPoint')?.getAttribute('name');
    const iedName = control.closest('IED')?.getAttribute('name');
    if (!apName || !iedName) return null;
    return control.ownerDocument.querySelector(
      `:root > Communication > SubNetwork > ConnectedAP[iedName="${iedName}"][apName="${apName}"]`,
    );
  }

  /** Builds an unsaved SMV when multicast is on and the file has none. */
  private ensureDraft(): void {
    if (!this.multicastOn || this.creating || !this.control || this.draftedSmv) return;
    if (this.liveSmv()) return;
    const ldInst = this.control.closest('LDevice')?.getAttribute('inst');
    const cbName = this.control.getAttribute('name');
    const connected = this.connectedApOf(this.control);
    if (!connected || !ldInst || !cbName) return;
    const insert = createSMV(connected, { ldInst, cbName });
    const node = insert?.node;
    if (!insert || !(node instanceof Element)) return;
    this.draftInsert = insert;
    this.draftedSmv = node;
  }

  /** Field setters do not wait for the inner control to render. */
  private async resync(): Promise<void> {
    const generation = ++this.resyncGeneration;
    this.multicastGeneration++;
    this.clearTitleTimer();
    this.stagedDataSet = undefined;
    this.addressMemory = null;
    this.draftInsert = null;
    this.draftedSmv = null;
    this.multicastOn = this.multicastFromControl();
    if (this.multicastOn) this.ensureDraft();
    await this.updateComplete;
    if (generation !== this.resyncGeneration) return;
    this.syncFromElements();
    this.publishTitle();
    await this.settleFields();
    if (generation !== this.resyncGeneration) return;
    await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
    if (generation !== this.resyncGeneration) return;
    this.publishTitle();
    this.refreshState();
  }

  /** Validity reads the Material control, which updates after the wrapper. */
  private async settleFields(): Promise<void> {
    const fields = Array.from(
      this.renderRoot.querySelectorAll(
        'publisher-text-field, publisher-radio, publisher-select, publisher-checkbox',
      ),
    ) as LitElement[];
    await Promise.all(
      fields.map(async field => {
        await field.updateComplete;
        const inner = field.renderRoot?.querySelector(
          'md-outlined-text-field, md-outlined-select',
        ) as LitElement | null;
        if (inner?.updateComplete) await inner.updateComplete;
      }),
    );
  }

  private readTitleName(): string {
    const value = this.nameField?.value;
    if (typeof value === 'string') return value;
    return this.control?.getAttribute('name') ?? 'SampledValueControl';
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
    if (this.multicastField && event.composedPath().includes(this.multicastField)) {
      void this.followMulticast();
    } else {
      this.refreshState();
    }
    const nameField = this.nameField;
    if (nameField && event.composedPath().includes(nameField)) {
      this.scheduleTitle();
    }
  }

  /** A close from an older show must not drop a create that already replaced it. */
  private finishClose(): void {
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

  private addressText(smv: Element, type: string): string | null {
    return (
      Array.from(smv.querySelectorAll(':scope > Address > P'))
        .find(item => item.getAttribute('type') === type)
        ?.textContent?.trim() ?? null
    );
  }

  private syncFromElements(): void {
    const control = this.control;
    if (
      !control ||
      !this.nameField ||
      !this.descField ||
      !this.confRevField ||
      !this.smvIdField ||
      !this.smpModField ||
      !this.smpRateField ||
      !this.nofAsduField ||
      !this.securityField
    ) {
      return;
    }

    this.nameField.value = control.getAttribute('name') ?? '';
    this.descField.value = control.getAttribute('desc');
    this.confRevField.value = control.getAttribute('confRev');
    this.smvIdField.value = control.getAttribute('smvID') ?? '';
    this.smpModField.value = control.getAttribute('smpMod');
    this.smpRateField.value = control.getAttribute('smpRate') ?? '';
    this.nofAsduField.value = control.getAttribute('nofASDU') ?? '';
    this.securityField.value = control.getAttribute('securityEnabled');
    if (this.multicastField) {
      this.multicastField.value = control.getAttribute('multicast');
    }

    this.syncDatasetFields();
    this.syncOptionFields();
    this.syncAddressFields();
  }

  private syncOptionFields(): void {
    const opts = this.control?.querySelector(':scope > SmvOpts');
    const assign = (
      field: PublisherCheckbox | undefined,
      key: string,
    ): void => {
      if (field) field.value = opts?.getAttribute(key) ?? null;
    };
    assign(this.refreshTimeField, 'refreshTime');
    assign(this.sampleSynchronizedField, 'sampleSynchronized');
    assign(this.sampleRateOptField, 'sampleRate');
    assign(this.dataSetOptField, 'dataSet');
    assign(this.securityOptField, 'security');
    assign(this.timestampField, 'timestamp');
    assign(this.synchSourceField, 'synchSourceId');
  }

  private syncAddressFields(): void {
    const smv = this.smv;
    if (
      !smv ||
      !this.macField ||
      !this.appIdField ||
      !this.vlanIdField ||
      !this.vlanPriorityField ||
      !this.instTypeField
    ) {
      return;
    }

    this.macField.value = this.addressText(smv, 'MAC-Address') ?? '';
    this.appIdField.value = this.addressText(smv, 'APPID') ?? '';
    this.vlanIdField.value = this.addressText(smv, 'VLAN-ID');
    this.vlanPriorityField.value = this.addressText(smv, 'VLAN-PRIORITY');
    const hasInstType = Array.from(smv.querySelectorAll(':scope > Address > P')).some(
      item => item.hasAttribute('xsi:type'),
    );
    this.instTypeField.value = hasInstType ? 'true' : 'false';
  }

  private controlChanges(): Record<string, string | null> {
    const control = this.control;
    if (!control || !this.nameField) return {};

    const next: Record<string, string | null> = {
      name: this.nameField.value ?? '',
      desc: this.stored(this.descField?.value),
      confRev: this.stored(this.confRevField?.value),
      smvID: this.smvIdField?.value ?? '',
      smpMod: this.stored(this.smpModField?.value),
      smpRate: this.smpRateField?.value ?? '',
      nofASDU: this.nofAsduField?.value ?? '',
      securityEnabled: this.stored(this.securityField?.value),
    };
    if (this.multicastField) next.multicast = this.multicastField.value;

    const attributes: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(next)) {
      const current = control.getAttribute(key);
      const old =
        key === 'name' || key === 'smvID' || key === 'smpRate' || key === 'nofASDU'
          ? (current ?? '')
          : this.stored(current);
      if (old !== value) attributes[key] = value;
    }
    return attributes;
  }

  private optionFields(): Array<[string, PublisherCheckbox | undefined]> {
    return [
      ['refreshTime', this.refreshTimeField],
      ['sampleSynchronized', this.sampleSynchronizedField],
      ['sampleRate', this.sampleRateOptField],
      ['dataSet', this.dataSetOptField],
      ['security', this.securityOptField],
      ['timestamp', this.timestampField],
      ['synchSourceId', this.synchSourceField],
    ];
  }

  /** A missing SmvOpts element is left absent. */
  private optionChanges(): Record<string, string | null> {
    const opts = this.control?.querySelector(':scope > SmvOpts');
    if (!opts) return {};

    const attributes: Record<string, string | null> = {};
    for (const [key, field] of this.optionFields()) {
      if (!field) continue;
      const value = this.stored(field.value);
      if (this.stored(opts.getAttribute(key)) !== value) attributes[key] = value;
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
    const smv = this.smv;
    if (!smv || !this.macField) return false;
    return checkSMVDiff(smv, {
      pTypes: {
        'MAC-Address': this.stored(this.macField.value),
        APPID: this.stored(this.appIdField?.value),
        'VLAN-ID': this.stored(this.vlanIdField?.value),
        'VLAN-PRIORITY': this.stored(this.vlanPriorityField?.value),
      },
      instType: this.instTypeField?.value === 'true',
    });
  }

  /** A new SMV is inserted, or an existing one is removed, on save. */
  private smvPresenceChanged(): boolean {
    const live = this.liveSmv();
    if (this.multicastOn) return !this.creating && !live && !!this.draftedSmv;
    return !!live;
  }

  private hasChanges(): boolean {
    return (
      Object.keys(this.controlChanges()).length > 0 ||
      Object.keys(this.optionChanges()).length > 0 ||
      this.datasetLinkChanged() ||
      this.communicationChanged() ||
      this.smvPresenceChanged()
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

  private captureAddress(): void {
    if (
      !this.macField ||
      !this.appIdField ||
      !this.vlanIdField ||
      !this.vlanPriorityField ||
      !this.instTypeField
    ) {
      return;
    }
    this.addressMemory = {
      mac: this.macField.value ?? '',
      appId: this.appIdField.value ?? '',
      vlanId: this.vlanIdField.value,
      vlanPriority: this.vlanPriorityField.value,
      instType: this.instTypeField.value === 'true',
    };
  }

  private applyAddressMemory(): void {
    const memory = this.addressMemory;
    if (
      !memory ||
      !this.macField ||
      !this.appIdField ||
      !this.vlanIdField ||
      !this.vlanPriorityField ||
      !this.instTypeField
    ) {
      return;
    }
    this.macField.value = memory.mac;
    this.appIdField.value = memory.appId;
    this.vlanIdField.value = memory.vlanId;
    this.vlanPriorityField.value = memory.vlanPriority;
    this.instTypeField.value = memory.instType ? 'true' : 'false';
  }

  /** Shows or hides the address after the multicast lock or checkbox changes. */
  private async followMulticast(): Promise<void> {
    const generation = ++this.multicastGeneration;
    const field = this.multicastField;
    if (!field) return;
    const on = field.value !== 'false';
    if (on !== this.multicastOn) {
      if (!on) this.captureAddress();
      this.multicastOn = on;
      if (on) this.ensureDraft();
      await this.updateComplete;
      if (generation !== this.multicastGeneration) return;
      if (on) {
        if (this.addressMemory) this.applyAddressMemory();
        else this.syncAddressFields();
      }
      await this.settleFields();
      if (generation !== this.multicastGeneration) return;
    }
    this.refreshState();
  }

  private saveChanges(): void {
    const control = this.control;
    if (!control || !this.canSave) return;

    const edits = [];
    const attributes = this.controlChanges();
    if (Object.keys(attributes).length > 0) {
      if (this.creating && attributes.name && this.pendingSmv && this.multicastOn) {
        this.pendingSmv.setAttribute('cbName', attributes.name);
      }
      edits.push(...updateSampledValueControl({ element: control, attributes }));
    }
    if (this.datasetLinkChanged()) {
      edits.push({
        element: control,
        attributes: { datSet: this.stagedDataSet?.getAttribute('name') ?? '' },
      });
    }

    const optionAttributes = this.optionChanges();
    const opts = control.querySelector(':scope > SmvOpts');
    if (opts && Object.keys(optionAttributes).length > 0) {
      edits.push({ element: opts, attributes: optionAttributes });
    }

    const live = this.liveSmv();
    if (this.multicastOn && !live && this.draftedSmv && this.draftInsert) {
      const cbName = this.nameField?.value || control.getAttribute('name') || '';
      if (cbName) this.draftedSmv.setAttribute('cbName', cbName);
      edits.push(this.draftInsert);
    }

    const smv = this.smv;
    if (smv && this.communicationChanged()) {
      const options: ChangeGseOrSmvAddressOptions = {
        instType: this.instTypeField?.value === 'true',
      };
      const mac = this.macField?.value;
      const appId = this.appIdField?.value;
      const vlanId = this.vlanIdField?.value;
      const vlanPriority = this.vlanPriorityField?.value;
      if (mac) options.mac = mac;
      if (appId) options.appId = appId;
      if (vlanId) options.vlanId = vlanId;
      if (vlanPriority) options.vlanPriority = vlanPriority;
      edits.push(...changeSMVContent(smv, options));
    }

    if (!this.multicastOn && live) edits.push({ node: live });

    if (this.creating) {
      this.savedEdit = true;
      this.dispatchEvent(
        new CustomEvent('create-accept', {
          detail: { edits, includeSmv: this.multicastOn },
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
      newEditEvent(edits, {
        title: `Update SampledValueControl ${identity(control)}`,
      }),
    );
    this.canSave = false;
    if (this.dialog?.open) {
      this.savedEdit = true;
      this.dialog.close();
    }
  }

  render(): TemplateResult {
    const name = this.titleName ?? this.control?.getAttribute('name') ?? 'SampledValueControl';
    const path =
      this.creating && this.createPath
        ? this.createPath
        : this.control
          ? pathIdentity(this.control)
          : '';
    const datasetLocked = dataSetLinkLocked(this.control);

    return html`<publisher-edit-dialog .name=${name} .path=${path}>
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
              supportingText="Sampled Value Name"
            ></publisher-text-field>
            <publisher-text-field
              class="control desc"
              label="Description"
              nullable
              supportingText="Sampled Value Description"
            ></publisher-text-field>
            <publisher-text-field
              class="control conf-rev"
              label="Configuration Revision"
              nullable
              pattern=${patterns.unsigned}
              supportingText="Configuration Revision"
            ></publisher-text-field>
            <publisher-text-field
              class="control smv-id"
              label="Sampled Value ID"
              required
              supportingText="Sampled Value ID"
            ></publisher-text-field>
            <publisher-text-field
              class="control smp-rate"
              label="Sample rate"
              required
              type="number"
              supportingText="Sample Rate (Based on Sample Mode)"
            ></publisher-text-field>
            <publisher-text-field
              class="control nof-asdu"
              label="Number of ASDU"
              required
              type="number"
              supportingText="Number of Samples per Ethernet packet"
            ></publisher-text-field>
          </section>
          <section class="card">
            <h3>Sample mode</h3>
            <publisher-radio
              class="control sample-mode"
              label="Sample mode"
              nullable
              required
              supportingText="Sample mode (Samples per Second, Sampled per Period, Seconds per Sample)"
              .options=${sampleModeOptions}
            ></publisher-radio>
          </section>
          <section class="card">
            <h3>Security</h3>
            <publisher-radio
              class="control security"
              label="Security"
              nullable
              required
              supportingText="Sampled Value Security Setting"
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
            <h3>Sampled Value Options</h3>
            <publisher-checkbox
              class="opt refresh-time"
              label="Refresh time"
              nullable
              supportingText=${smvOptHelp.refreshTime}
            ></publisher-checkbox>
            <publisher-checkbox
              class="opt sample-synchronized"
              label="Sample synchronized"
              nullable
              supportingText=${smvOptHelp.sampleSynchronized}
            ></publisher-checkbox>
            <publisher-checkbox
              class="opt sample-rate"
              label="Sample rate"
              nullable
              supportingText=${smvOptHelp.sampleRate}
            ></publisher-checkbox>
            <publisher-checkbox
              class="opt data-set"
              label="Data set reference"
              nullable
              supportingText=${smvOptHelp.dataSet}
            ></publisher-checkbox>
            <publisher-checkbox
              class="opt security"
              label="Security"
              nullable
              supportingText=${smvOptHelp.security}
            ></publisher-checkbox>
            <publisher-checkbox
              class="opt timestamp"
              label="Timestamp"
              nullable
              supportingText=${smvOptHelp.timestamp}
            ></publisher-checkbox>
            <publisher-checkbox
              class="opt synch-source"
              label="Synchronization source"
              nullable
              supportingText=${smvOptHelp.synchSourceId}
            ></publisher-checkbox>
          </section>
          <section class="card">
            <h3>Communication settings</h3>
            <publisher-checkbox
              class="control multicast"
              label="Multicast"
              nullable
              checkedWhenLocked
              supportingText="Whether Sample Value Stream is multicast"
            ></publisher-checkbox>
            ${this.multicastOn
              ? this.smv
                ? html`<publisher-checkbox
                    class="comm inst-type"
                    label="Add XML Schema-instance type"
                  ></publisher-checkbox>
                  <publisher-text-field
                    class="comm mac"
                    label="MAC-Address"
                    required
                    placeholder="01-0C-CD-02-xx-xx"
                    pattern=${typePattern['MAC-Address'] ?? ''}
                    supportingText=${addressHelp['MAC-Address']}
                  ></publisher-text-field>
                  <publisher-text-field
                    class="comm app-id"
                    label="APPID"
                    required
                    placeholder="4xxx"
                    pattern=${typePattern.APPID ?? ''}
                    supportingText=${addressHelp.APPID}
                  ></publisher-text-field>
                  <publisher-text-field
                    class="comm vlan-id"
                    label="VLAN-ID"
                    nullable
                    required
                    placeholder="000"
                    pattern=${typePattern['VLAN-ID'] ?? ''}
                    supportingText=${addressHelp['VLAN-ID']}
                  ></publisher-text-field>
                  <publisher-select
                    class="comm vlan-priority"
                    label="VLAN priority"
                    nullable
                    required
                    supportingText=${addressHelp['VLAN-PRIORITY']}
                    .options=${vlanPriorityOptions}
                  ></publisher-select>`
                : html`<p class="empty">No connection available</p>`
              : ''}
          </section>
        </div>
      </div>
      <md-outlined-button slot="actions" @click=${() => this.dialog?.close()}
        >Cancel</md-outlined-button
      >
      <md-filled-button
        slot="actions"
        class="smv save"
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
        --publisher-edit-dialog-width: min(1250px, calc(100vw - 48px));
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

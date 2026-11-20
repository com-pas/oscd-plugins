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
  getReference,
  identity,
  updateReportControl,
} from '@openenergytools/scl-lib';
import { createElement } from '@openenergytools/scl-lib/dist/foundation/utils.js';

import {
  dataSetLinkLocked,
  subscribedDataSetTitle,
} from '../dataset-link-lock.js';
import { pathIdentity } from '../../foundation.js';
import { maxLength, patterns } from '../../foundation/pattern.js';
import { PublisherCheckbox } from '../../shared/components/publisher-checkbox.js';
import {
  publisherEditCardStyles,
  PublisherEditDialog,
} from '../../shared/components/publisher-edit-dialog.js';
import { PublisherTextField } from '../../shared/components/publisher-text-field.js';
import { updateMaxClients } from './foundation.js';

const titleDebounceMs = 200;

const triggerOptions = [
  { attr: 'dchg', label: 'dchg', supportingText: 'Data change' },
  { attr: 'qchg', label: 'qchg', supportingText: 'Data quality change' },
  { attr: 'dupd', label: 'dupd', supportingText: 'Data update' },
  { attr: 'period', label: 'period', supportingText: 'Periodically send Report' },
  { attr: 'gi', label: 'gi', supportingText: 'Manually' },
] as const;

const optionalFields = [
  { attr: 'seqNum', label: 'seqNum', supportingText: 'Sequence Number' },
  { attr: 'timeStamp', label: 'timeStamp', supportingText: 'Time Stamp' },
  { attr: 'dataSet', label: 'dataSet', supportingText: 'DataSet reference' },
  { attr: 'reasonCode', label: 'reasonCode', supportingText: 'Reason for trigger' },
  { attr: 'dataRef', label: 'dataRef', supportingText: 'Structure of DataSet' },
  { attr: 'entryID', label: 'entryID', supportingText: 'ID for Report' },
  { attr: 'configRef', label: 'configRef', supportingText: 'Configuration Revision' },
  { attr: 'bufOvfl', label: 'bufOvfl', supportingText: 'Indicator for buffer overflow' },
] as const;

type OptionField = { attr: string; field: PublisherCheckbox };

/** Edits one ReportControl. The linked DataSet is read-only. */
export class ReportControlEditDialog extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'md-filled-button': MdFilledButton,
    'publisher-edit-dialog': PublisherEditDialog,
    'md-icon': MdIcon,
    'md-outlined-button': MdOutlinedButton,
    'publisher-checkbox': PublisherCheckbox,
    'publisher-text-field': PublisherTextField,
  };

  /** ReportControl being edited. */
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

  /** Header path while `creating`. The detached control has no parent. */
  @property({ type: String })
  createPath = '';

  @state()
  private canSave = false;

  /** Name shown in the header. `null` while no control is loaded. */
  @state()
  private titleName: string | null = null;

  @state()
  private maxHint = '';

  private savedEdit = false;

  /** Browser timer id. DOM `setTimeout` returns a number, not Node's `Timeout`. */
  private titleTimer: number | undefined;

  @query('publisher-edit-dialog') private dialog?: PublisherEditDialog;

  @query('.control.name') private nameField?: PublisherTextField;
  @query('.control.desc') private descField?: PublisherTextField;
  @query('.control.conf-rev') private confRevField?: PublisherTextField;
  @query('.control.rpt-id') private rptIdField?: PublisherTextField;
  @query('.control.max') private maxField?: PublisherTextField;
  @query('.control.indexed') private indexedField?: PublisherCheckbox;
  @query('.control.buffered') private bufferedField?: PublisherCheckbox;
  @query('.control.buf-time') private bufTimeField?: PublisherTextField;
  @query('.control.intg-pd') private intgPdField?: PublisherTextField;
  @query('.dataset.name') private datasetNameField?: PublisherTextField;
  @query('.dataset.desc') private datasetDescField?: PublisherTextField;

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

  /** Field setters do not wait for the inner control to render. */
  private async resync(): Promise<void> {
    this.clearTitleTimer();
    this.stagedDataSet = undefined;
    this.syncFromElements();
    this.publishTitle();
    const fields = Array.from(
      this.renderRoot.querySelectorAll('publisher-text-field, publisher-checkbox'),
    ) as LitElement[];
    await Promise.all(fields.map(field => field.updateComplete));
    this.publishTitle();
    this.refreshState();
  }

  private hostInputsChanged(changed: PropertyValues): boolean {
    return (
      changed.has('control') ||
      changed.has('dataSet') ||
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
    if (
      !control ||
      !this.nameField ||
      !this.descField ||
      !this.confRevField ||
      !this.rptIdField ||
      !this.maxField ||
      !this.indexedField ||
      !this.bufferedField ||
      !this.bufTimeField ||
      !this.intgPdField
    ) {
      return;
    }

    this.nameField.value = control.getAttribute('name') ?? '';
    this.descField.value = control.getAttribute('desc');
    this.confRevField.value = control.getAttribute('confRev');
    this.rptIdField.value = control.getAttribute('rptID');
    this.indexedField.value = control.getAttribute('indexed');
    this.bufferedField.value =
      control.getAttribute('buffered') === 'true' ? 'true' : 'false';
    this.bufTimeField.value = control.getAttribute('bufTime');
    this.intgPdField.value = control.getAttribute('intgPd');
    const rptEnabled = control.querySelector(':scope > RptEnabled');
    this.maxField.value = rptEnabled?.getAttribute('max') ?? null;

    this.syncOptionFields('trg', control.querySelector(':scope > TrgOps'));
    this.syncOptionFields('opt', control.querySelector(':scope > OptFields'));
    this.syncDatasetFields();
  }

  private syncOptionFields(kind: 'trg' | 'opt', element: Element | null): void {
    for (const { attr, field } of this.optionFields(kind)) {
      field.value = element?.getAttribute(attr) ?? null;
    }
  }

  private optionFields(kind: 'trg' | 'opt'): OptionField[] {
    return Array.from(
      this.renderRoot.querySelectorAll(`publisher-checkbox.${kind}`),
    ).map(node => ({
      attr: (node as HTMLElement).dataset.attr ?? '',
      field: node as PublisherCheckbox,
    }));
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
      this.datasetNameField.value =
        shown?.getAttribute('name') ?? 'No DataSet connected';
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

  private textChanged(
    field: PublisherTextField | undefined,
    attribute: string | null,
  ): string | null | undefined {
    if (!field) return undefined;
    const next = this.stored(field.value);
    const old = this.stored(attribute);
    return next === old ? undefined : next;
  }

  private reportAttributeChanges(): Record<string, string | null> {
    const control = this.control;
    if (!control || !this.nameField || !this.bufferedField || !this.indexedField) {
      return {};
    }

    const attributes: Record<string, string | null> = {};
    const name = this.nameField.value ?? '';
    if ((control.getAttribute('name') ?? '') !== name) attributes.name = name;

    const desc = this.textChanged(this.descField, control.getAttribute('desc'));
    if (desc !== undefined) attributes.desc = desc;
    const confRev = this.textChanged(
      this.confRevField,
      control.getAttribute('confRev'),
    );
    if (confRev !== undefined) attributes.confRev = confRev;
    const rptID = this.textChanged(this.rptIdField, control.getAttribute('rptID'));
    if (rptID !== undefined) attributes.rptID = rptID;
    const bufTime = this.textChanged(
      this.bufTimeField,
      control.getAttribute('bufTime'),
    );
    if (bufTime !== undefined) attributes.bufTime = bufTime;
    const intgPd = this.textChanged(
      this.intgPdField,
      control.getAttribute('intgPd'),
    );
    if (intgPd !== undefined) attributes.intgPd = intgPd;

    const indexed = this.indexedField.value;
    if ((control.getAttribute('indexed') ?? null) !== indexed) {
      attributes.indexed = indexed;
    }

    const buffered = this.bufferedField.value ?? 'false';
    const storedBuffered =
      control.getAttribute('buffered') === 'true' ? 'true' : 'false';
    if (buffered !== storedBuffered) attributes.buffered = buffered;

    return attributes;
  }

  private optionChanges(
    kind: 'trg' | 'opt',
    element: Element | null,
  ): Record<string, string | null> | null {
    const attributes: Record<string, string | null> = {};
    for (const { attr, field } of this.optionFields(kind)) {
      const next = field.value;
      if ((element?.getAttribute(attr) ?? null) !== next) attributes[attr] = next;
    }
    return Object.keys(attributes).length > 0 ? attributes : null;
  }

  private maxChanged(): boolean {
    const control = this.control;
    if (!control || !this.maxField) return false;
    const rptEnabled = control.querySelector(':scope > RptEnabled');
    return (rptEnabled?.getAttribute('max') ?? null) !== this.stored(this.maxField.value);
  }

  /** Missing RptEnabled skips the check. A closed lock counts as zero. */
  private maxClientsAllowed(): boolean {
    const rptEnabled = this.control?.querySelector(':scope > RptEnabled');
    if (!rptEnabled) return true;
    const clientLNs = rptEnabled.querySelectorAll(':scope > ClientLN').length;
    if (clientLNs === 0) return true;
    const max = this.maxField?.value;
    if (!max) return false;
    return clientLNs <= Number.parseInt(max, 10);
  }

  private hasChanges(): boolean {
    const control = this.control;
    if (!control) return false;
    return (
      Object.keys(this.reportAttributeChanges()).length > 0 ||
      this.maxChanged() ||
      this.optionChanges('trg', control.querySelector(':scope > TrgOps')) !==
        null ||
      this.optionChanges('opt', control.querySelector(':scope > OptFields')) !==
        null ||
      this.datasetLinkChanged()
    );
  }

  private refreshState(): void {
    const fields = Array.from(
      this.renderRoot.querySelectorAll('publisher-text-field, publisher-checkbox'),
    ) as Array<{ reportValidity?: () => boolean }>;
    const valid = fields.every(field => field.reportValidity?.() !== false);
    const allowed = this.maxClientsAllowed();
    const hint = allowed ? '' : this.maxClientHint();
    if (hint !== this.maxHint) this.maxHint = hint;
    this.canSave = valid && allowed && (this.creating || this.hasChanges());
  }

  private maxClientHint(): string {
    const count =
      this.control
        ?.querySelector(':scope > RptEnabled')
        ?.querySelectorAll(':scope > ClientLN').length ?? 0;
    return `There are ${count} clientLNs`;
  }

  private collectEdits(control: Element) {
    const edits = [];
    const attributes = this.reportAttributeChanges();
    if (Object.keys(attributes).length > 0) {
      edits.push(...updateReportControl({ element: control, attributes }));
    }

    if (this.maxChanged()) {
      const maxAction = updateMaxClients(control, this.stored(this.maxField?.value));
      if (maxAction) edits.push(maxAction);
    }

    this.pushOptionEdit(edits, control, 'trg', 'TrgOps');
    this.pushOptionEdit(edits, control, 'opt', 'OptFields');

    if (this.datasetLinkChanged()) {
      edits.push({
        element: control,
        attributes: { datSet: this.stagedDataSet?.getAttribute('name') ?? '' },
      });
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
      newEditEvent(edits, { title: `Update ReportControl ${identity(control)}` }),
    );
    this.canSave = false;
    if (this.dialog?.open) {
      this.savedEdit = true;
      this.dialog.close();
    }
  }

  private pushOptionEdit(
    edits: unknown[],
    control: Element,
    kind: 'trg' | 'opt',
    tag: 'TrgOps' | 'OptFields',
  ): void {
    const element = control.querySelector(`:scope > ${tag}`);
    const attributes = this.optionChanges(kind, element);
    if (!attributes) return;
    if (!element) {
      edits.push({
        parent: control,
        node: createElement(control.ownerDocument, tag, attributes),
        reference: getReference(control, tag),
      });
      return;
    }
    edits.push({ element, attributes });
  }

  private renderOption(
    kind: 'trg' | 'opt',
    item: { attr: string; label: string; supportingText: string },
  ): TemplateResult {
    return html`<publisher-checkbox
      class=${kind}
      data-attr=${item.attr}
      label=${item.label}
      supportingText=${item.supportingText}
      nullable
    ></publisher-checkbox>`;
  }

  render(): TemplateResult {
    const name =
      this.titleName ?? this.control?.getAttribute('name') ?? 'ReportControl';
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
              class="control conf-rev"
              label="Configuration Revision"
              nullable
              pattern=${patterns.unsigned}
            ></publisher-text-field>
            <publisher-text-field
              class="control rpt-id"
              label="rptID"
              nullable
            ></publisher-text-field>
            <publisher-text-field
              class="control max"
              label="Max. clients"
              nullable
              type="number"
              pattern="[0-9]+"
              supportingText=${this.maxHint}
            ></publisher-text-field>
            <publisher-checkbox
              class="control indexed"
              label="Indexed"
              nullable
            ></publisher-checkbox>
            <publisher-checkbox
              class="control buffered"
              label="Buffered"
            ></publisher-checkbox>
          </section>
          <section class="card">
            <h3>Trigger options</h3>
            ${triggerOptions.map(item => this.renderOption('trg', item))}
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
            <h3>Time</h3>
            <publisher-text-field
              class="control buf-time"
              label="bufTime"
              required
              nullable
              type="number"
              pattern="[0-9]+"
              supportingText="Minimum time between two ReportControl"
            ></publisher-text-field>
            <publisher-text-field
              class="control intg-pd"
              label="Integrity period"
              required
              nullable
              type="number"
              pattern="[0-9]+"
            ></publisher-text-field>
          </section>
          <section class="card">
            <h3>Optional fields</h3>
            ${optionalFields.map(item => this.renderOption('opt', item))}
          </section>
        </div>
      </div>
      <md-outlined-button slot="actions" @click=${() => this.dialog?.close()}
        >Cancel</md-outlined-button
      >
      <md-filled-button
        slot="actions"
        class="report save"
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

      @media (max-width: 800px) {
        .edit-grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ];
}

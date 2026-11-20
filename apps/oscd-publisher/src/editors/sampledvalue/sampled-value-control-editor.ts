import { css, html, type PropertyValues, type TemplateResult } from 'lit';
import { query, state } from 'lit/decorators.js';

import { ActionList } from '@openenergytools/filterable-lists/dist/ActionList.js';
import { MdDialog } from '@scopedelement/material-web/dialog/MdDialog.js';
import { MdIcon } from '@scopedelement/material-web/icon/MdIcon.js';
import { MdIconButton } from '@scopedelement/material-web/iconbutton/MdIconButton.js';
import { MdOutlinedButton } from '@scopedelement/material-web/button/MdOutlinedButton.js';
import { MdCheckbox } from '@scopedelement/material-web/checkbox/MdCheckbox.js';

import { newEditEvent } from '@openenergytools/open-scd-core';
import {
  createSampledValueControl,
  identity,
  removeControlBlock,
} from '@openenergytools/scl-lib';

import { newLogEvent } from '../../foundation/log-event.js';
import { pathIdentity, styles } from '../../foundation.js';
import { PublisherLDeviceSelectDialog } from '../../shared/components/publisher-ldevice-select-dialog.js';
import {
  PublisherSelectionList,
  renderIedAddButton,
  type SelectionListGroup,
} from '../../shared/components/publisher-selection-list.js';
import { iedLDevices, smvAddBlock, smvLDeviceBlock } from '../add-block.js';
import {
  BaseElementEditor,
  ControlBlockCopyStatus,
} from '../base-element-editor.js';

import { DataSetElementEditor } from '../dataset/data-set-element-editor.js';
import { SampledValueControlEditDialog } from './sampled-value-control-edit-dialog.js';

interface SmvListGroup extends SelectionListGroup<Element> {
  ied: Element;
}

const smvLDeviceMessage =
  'Choose the LDevice to which the new Sampled Value will be added.';

/** Same labels as the Sampled Value edit dialog. */
const securityLabels: Record<string, string> = {
  None: 'None',
  Signature: 'Signature only',
  SignatureAndEncryption: 'Signature & encryption',
};

/** Absent attribute is "-". An empty string stays empty. */
function absentDash(value: string | null): string {
  return value === null ? '-' : value;
}

function securityText(control: Element): string {
  const value = control.getAttribute('securityEnabled');
  if (value === null) return '-';
  return securityLabels[value] ?? value;
}

export class SampledValueControlEditor extends BaseElementEditor {
  static scopedElements = {
    'action-list': ActionList,
    'publisher-selection-list': PublisherSelectionList,
    'data-set-element-editor': DataSetElementEditor,
    'md-outlined-button': MdOutlinedButton,
    'sampled-value-control-edit-dialog': SampledValueControlEditDialog,
    'publisher-ldevice-select-dialog': PublisherLDeviceSelectDialog,
    'md-icon-button': MdIconButton,
    'md-icon': MdIcon,
    'md-dialog': MdDialog,
    'md-checkbox': MdCheckbox,
  };

  @query('.selectionlist')
  selectionList!: PublisherSelectionList<Element>;

  @query('.change.scl.element')
  selectSampledValueControlButton!: MdOutlinedButton;

  @query('data-set-element-editor')
  dataSetElementEditor!: DataSetElementEditor;

  @query('sampled-value-control-edit-dialog')
  private sampledValueEditDialog?: SampledValueControlEditDialog;

  @query('publisher-ldevice-select-dialog')
  lDeviceSelectDialog!: PublisherLDeviceSelectDialog;

  @state()
  private lDevices: Element[] = [];

  @state()
  private selectedLDevice: Element | null = null;

  private selectedIed: Element | null = null;

  private lDevicePath = '';

  /** Row whose Sampled Value dialog is open. Distinct from the detail. */
  @state()
  private editControl: Element | null = null;

  @state()
  private editDataSet: Element | null = null;

  @state()
  private creating = false;

  @state()
  private pendingSmv: Element | null = null;

  @state()
  private createPath = '';

  private pendingSmvCreate: {
    iedName: string;
    inserts: { parent: Node; node: Node; reference: Node | null }[];
    control: Element;
  } | null = null;

  /** The picker stays at the root so Connect works before the detail exists. */
  protected override dataSetPickerInDetail = false;

  /** Row whose picker is open. Distinct from the control shown in the detail. */
  @state()
  private connectControl?: Element;

  private stageDatasetPick = false;

  /** Drops the listener from the picker session that is about to be replaced. */
  private clearPicker?: () => void;

  protected override onDocumentReplaced(): void {
    this.clearPicker?.();
    this.sampledValueEditDialog?.close();
    this.lDeviceSelectDialog?.close();
    this.dataSetElementEditor?.closeOpenDialogs();
    this.connectControl = undefined;
    this.stageDatasetPick = false;
    this.creating = false;
    this.pendingSmv = null;
    this.pendingSmvCreate = null;
    this.createPath = '';
    this.editControl = null;
    this.editDataSet = null;
    this.lDevices = [];
    this.selectedLDevice = null;
    this.selectedIed = null;
    this.lDevicePath = '';
  }

  protected override dataSetPickerControl(): Element | undefined {
    return this.connectControl ?? this.selectCtrlBlock;
  }

  protected override selectDataSet(dataSet: Element): void {
    if (this.stageDatasetPick) {
      this.stageDatasetPick = false;
      this.connectControl = undefined;
      this.sampledValueEditDialog?.stageDataSet(dataSet);
      this.selectDataSetDialog.close();
      return;
    }
    const control = this.dataSetPickerControl();
    super.selectDataSet(dataSet);
    if (control && control === this.editControl) this.editDataSet = dataSet;
  }

  override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!changed.has('editCount') || !this.selectCtrlBlock) return;
    const next = this.getDataSet(this.selectCtrlBlock);
    if (next !== this.selectedDataSet) this.selectedDataSet = next;
  }

  private renderElementEditorContainer(): TemplateResult {
    if (this.selectCtrlBlock !== undefined)
      return html`<div class="elementeditorcontainer">
        ${this.renderDataSetElementContainer()}
      </div>`;

    return html``;
  }

  private sampledValuesIn(ied: Element): Element[] {
    return Array.from(
      ied.querySelectorAll(
        ':scope > AccessPoint > Server > LDevice > LN0 > SampledValueControl'
      )
    );
  }

  private selectionGroups(): SmvListGroup[] {
    return this.queryIEDs().map(ied => {
      const rows = this.sampledValuesIn(ied);
      const label = ied.getAttribute('name') ?? '';
      return { id: label, label, count: rows.length, rows, ied };
    });
  }

  private sampledValueMatches(control: Element, query: string): boolean {
    const name = control.getAttribute('name') ?? '';
    return (
      name.toLowerCase().includes(query) ||
      pathIdentity(control).toLowerCase().includes(query)
    );
  }

  private visibleRows = (
    group: SmvListGroup,
    query: string
  ): Element[] | null => {
    if (!query) return group.rows;
    if (group.label.toLowerCase().includes(query)) return group.rows;
    const matches = group.rows.filter(control =>
      this.sampledValueMatches(control, query)
    );
    return matches.length > 0 ? matches : null;
  };

  private startCreateSampledValue(ied: Element): void {
    if (smvAddBlock(ied)) return;
    const devices = iedLDevices(ied);
    if (devices.length === 1) {
      this.createSampledValue(ied, devices[0]);
      return;
    }
    const id = identity(ied);
    this.lDevicePath = typeof id === 'string' ? id : '';
    this.selectedLDevice = null;
    this.selectedIed = ied;
    this.lDevices = devices;
    void this.updateComplete.then(() => this.lDeviceSelectDialog?.show());
  }

  private selectLDevice(lDevice: Element | null): void {
    if (lDevice && smvLDeviceBlock(lDevice)) return;
    this.selectedLDevice = lDevice;
  }

  private acceptLDevice(): void {
    this.lDeviceSelectDialog?.close();
    const ied = this.selectedIed;
    const lDevice = this.selectedLDevice;
    if (!ied || !lDevice || smvLDeviceBlock(lDevice)) return;
    this.createSampledValue(ied, lDevice);
  }

  private createSampledValue(ied: Element, lDevice: Element): void {
    if (smvAddBlock(ied) || smvLDeviceBlock(lDevice)) return;
    const inserts = createSampledValueControl(lDevice);
    const controlInsert = inserts.find(
      insert => (insert.node as Element).tagName === 'SampledValueControl',
    );
    if (controlInsert) {
      const parent = controlInsert.parent;
      const path = identity(parent as Element);
      const smvInsert = inserts.find(
        insert => (insert.node as Element).tagName === 'SMV',
      );
      this.pendingSmvCreate = {
        iedName: ied.getAttribute('name') ?? '',
        inserts,
        control: controlInsert.node as Element,
      };
      this.createDataSetParent = parent as Element;
      this.pendingSmv = (smvInsert?.node as Element | undefined) ?? null;
      this.createPath = typeof path === 'string' ? path : '';
      this.editDataSet = null;
      this.editControl = controlInsert.node as Element;
      this.creating = true;
      void this.updateComplete.then(() => this.sampledValueEditDialog?.show());
      return;
    }

    const iedName = ied.getAttribute('name');
    this.dispatchEvent(
      newLogEvent({
        title: 'Could not create SampledValueControl',
        kind: 'warning',
        message: `Could not create SampledValueControl for IED ${iedName}: an unknown validation error occurred.`,
      }),
    );
  }

  private commitSmvCreate(event: CustomEvent<{ edits?: unknown[]; includeSmv?: boolean }>): void {
    const pending = this.pendingSmvCreate;
    if (!pending) return;
    const extra = event.detail?.edits ?? [];
    const inserts =
      event.detail?.includeSmv === false
        ? pending.inserts.filter(insert => (insert.node as Element).tagName !== 'SMV')
        : pending.inserts;
    this.creating = false;
    this.pendingSmv = null;
    this.pendingSmvCreate = null;
    this.createDataSetParent = null;
    const payload = extra.length > 0 ? [...inserts, ...extra] : inserts;
    this.dispatchEvent(
      newEditEvent(payload as Parameters<typeof newEditEvent>[0], {
        title: 'Create New SampledValueControl',
      }),
    );
    this.selectionList?.openGroup(pending.iedName);
    this.openSampledValue(pending.control);
  }

  private cancelSmvCreate(): void {
    this.creating = false;
    this.pendingSmv = null;
    this.pendingSmvCreate = null;
    this.createDataSetParent = null;
    this.editControl = null;
    this.editDataSet = null;
  }

  private openSampledValue(control: Element): void {
    if (this.selectCtrlBlock === control) {
      this.sampledValueEditDialog?.close();
      this.selectCtrlBlock = undefined;
      this.selectedDataSet = undefined;
      this.selectionList.classList.remove('hidden');
      this.selectSampledValueControlButton.classList.add('hidden');
      return;
    }

    this.sampledValueEditDialog?.close();
    if (this.dataSetElementEditor) this.dataSetElementEditor.resetInputs();

    this.selectCtrlBlock = control;
    this.selectedDataSet = this.getDataSet(control);
    this.selectionList.classList.add('hidden');
    this.selectSampledValueControlButton.classList.remove('hidden');
  }

  private copySampledValue(ied: Element, control: Element): void {
    const lDevice = control.closest('LDevice');
    if (!lDevice) throw new Error('GSEControl has no LDevice parent');

    this.controlBlockCopyOptions = this.queryIEDs()
      .filter(otherIED => ied !== otherIED)
      .map(otherIED => {
        const status = this.getCopyControlBlockCopyStatus(control, otherIED);
        return {
          ied: otherIED,
          control,
          status,
          selected: status === ControlBlockCopyStatus.CanCopy,
        };
      });
    this.copyControlBlockDialog.show();
  }

  private removeSampledValue(control: Element): void {
    this.sampledValueEditDialog?.close();
    if (this.editControl === control) {
      this.editControl = null;
      this.editDataSet = null;
    }
    this.dispatchEvent(
      newEditEvent(removeControlBlock({ node: control }), {
        title: `Remove SampledValueControl`,
      })
    );
    this.selectCtrlBlock = undefined;
  }

  /** Opens the Sampled Value dialog for this row and leaves the detail closed. */
  private editSampledValue(control: Element): void {
    this.creating = false;
    this.pendingSmv = null;
    this.pendingSmvCreate = null;
    this.createDataSetParent = null;
    this.editControl = control;
    this.editDataSet = this.getDataSet(control);
    void this.updateComplete.then(() => {
      void this.sampledValueEditDialog?.show();
    });
  }

  /**
   * Opens the dataset picker for this control.
   * `stage` keeps the choice in the Sampled Value dialog until Save changes.
   */
  private connectSampledValue(control: Element, stage = false): void {
    this.clearPicker?.();
    this.connectControl = control;
    this.stageDatasetPick = stage;
    void this.updateComplete.then(() => {
      const dialog = this.selectDataSetDialog;
      const onClosed = () => {
        dialog.removeEventListener('closed', onClosed);
        if (this.clearPicker === remove) this.clearPicker = undefined;
        this.connectControl = undefined;
        this.stageDatasetPick = false;
      };
      const remove = () => dialog.removeEventListener('closed', onClosed);
      this.clearPicker = remove;
      dialog.addEventListener('closed', onClosed);
      dialog.show();
    });
  }

  private renderGroupAction = (group: SmvListGroup): TemplateResult =>
    renderIedAddButton('Add Sampled Value', smvAddBlock(group.ied), () =>
      this.startCreateSampledValue(group.ied),
    );

  private renderSmvHeader = (): TemplateResult => html`
    <span class="clip">Name</span>
    <span class="clip">Connected Data Set</span>
    <span class="clip narrow-hide">confRev</span>
    <span class="clip narrow-hide">Sample mode</span>
    <span class="clip narrow-hide">smpRate</span>
    <span class="clip narrow-hide">nofASDU</span>
    <span class="clip narrow-hide">Security</span>
    <span class="clip narrow-hide">Sampled Value ID</span>
    <span class="actions"></span>
  `;

  private renderSmvRow = (
    group: SmvListGroup,
    control: Element
  ): TemplateResult => {
    const name = control.getAttribute('name') ?? '';
    const dataSetName = control.getAttribute('datSet');
    const linkedDataSet = dataSetName ? this.getDataSet(control) : null;
    const selected = this.selectCtrlBlock === control;
    return html`<div
      class="dataset-row ${selected ? 'selected' : ''}"
      @click=${() => this.openSampledValue(control)}
    >
      <span class="cell clip dataset-name">${name}</span>
      <span class="cell dataset-cell">
        ${linkedDataSet
          ? html`<button
              type="button"
              class="dataset-connected"
              @click=${(event: Event) => this.openLinkedDataSet(event, control)}
            >${dataSetName}</button>`
          : dataSetName
            ? html`<span class="dataset-connected">${dataSetName}</span>`
            : html`<md-filled-button
                class="connect-dataset"
                @click=${(event: Event) => {
                  event.stopPropagation();
                  this.connectSampledValue(control);
                }}
                >Connect<md-icon slot="icon">link</md-icon></md-filled-button
              >`}
        ${this.renderDataSetDisconnect(control)}
      </span>
      <span class="cell clip conf-rev narrow-hide"
        >${absentDash(control.getAttribute('confRev'))}</span
      >
      <span class="cell clip smp-mod narrow-hide"
        >${absentDash(control.getAttribute('smpMod'))}</span
      >
      <span class="cell clip smp-rate narrow-hide"
        >${absentDash(control.getAttribute('smpRate'))}</span
      >
      <span class="cell clip nof-asdu narrow-hide"
        >${absentDash(control.getAttribute('nofASDU'))}</span
      >
      <span class="cell clip security narrow-hide">${securityText(control)}</span>
      <span class="cell clip smv-id narrow-hide"
        >${absentDash(control.getAttribute('smvID'))}</span
      >
      <span class="dataset-actions">
        <button
          type="button"
          class="icon-button dataset-edit"
          aria-label="Edit Sampled Value"
          title="Edit Sampled Value"
          @click=${(event: Event) => {
            event.stopPropagation();
            this.editSampledValue(control);
          }}
        >
          <md-icon aria-hidden="true">edit</md-icon>
        </button>
        <button
          type="button"
          class="icon-button dataset-copy"
          aria-label="Copy Sampled Value"
          title="Copy Sampled Value"
          @click=${(event: Event) => {
            event.stopPropagation();
            this.copySampledValue(group.ied, control);
          }}
        >
          <md-icon aria-hidden="true">folder_copy</md-icon>
        </button>
        <button
          type="button"
          class="icon-button dataset-delete"
          aria-label="Remove Sampled Value"
          title="Remove Sampled Value"
          @click=${(event: Event) => {
            event.stopPropagation();
            this.removeSampledValue(control);
          }}
        >
          <md-icon aria-hidden="true">delete</md-icon>
        </button>
      </span>
    </div>`;
  };

  private renderSelectionList(): TemplateResult {
    return html`${this.renderCopyControlBlockDialog()}
      <publisher-selection-list
        class="selectionlist"
        .columns=${true}
        .searchPlaceholder=${'Search Sampled Value Controls'}
        .groups=${this.selectionGroups()}
        .searchValue=${this.searchValue}
        .visibleRows=${this.visibleRows}
        .renderHeader=${this.renderSmvHeader}
        .renderRow=${this.renderSmvRow}
        .renderGroupAction=${this.renderGroupAction}
      ></publisher-selection-list>`;
  }

  private renderToggleButton(): TemplateResult {
    return html`<md-outlined-button
      class="change scl element"
      @click=${() => {
        this.selectionList.classList.remove('hidden');
        this.selectSampledValueControlButton.classList.add('hidden');
      }}
      >Select Sampled Value Control</md-outlined-button
    >`;
  }

  render(): TemplateResult {
    if (!this.doc) return html`No SCL loaded`;

    return html`${this.renderToggleButton()}
      ${this.renderSelectDataSetDialog()}
      <sampled-value-control-edit-dialog
        .control=${this.editControl}
        .dataSet=${this.editDataSet}
        .editCount=${this.editCount}
        .creating=${this.creating}
        .pendingSmv=${this.pendingSmv}
        .createPath=${this.createPath}
        @create-accept=${(event: CustomEvent<{ edits?: unknown[]; includeSmv?: boolean }>) =>
          this.commitSmvCreate(event)}
        @create-cancel=${() => this.cancelSmvCreate()}
        @change-dataset=${() => {
          if (this.editControl) this.connectSampledValue(this.editControl, true);
        }}
      ></sampled-value-control-edit-dialog>
      <publisher-ldevice-select-dialog
        .lDevices=${this.lDevices}
        .path=${this.lDevicePath}
        .selected=${this.selectedLDevice}
        .message=${smvLDeviceMessage}
        .blockReason=${smvLDeviceBlock}
        @ldevice-change=${(event: CustomEvent<Element>) => this.selectLDevice(event.detail)}
        @ldevice-accept=${() => this.acceptLDevice()}
      ></publisher-ldevice-select-dialog>
      <div class="section">
        ${this.renderSelectionList()}${this.renderElementEditorContainer()}
      </div>`;
  }

  static styles = css`
    ${styles}

    .selectionlist {
      flex: 50%;
      display: flex;
      flex-direction: column;
      min-width: 0;
      padding: 0;
      --selection-columns:
        minmax(130px, 1.4fr)
        minmax(130px, 1.6fr)
        minmax(60px, 0.6fr)
        minmax(90px, 1.1fr)
        minmax(60px, 0.6fr)
        minmax(60px, 0.6fr)
        minmax(110px, 1.3fr)
        minmax(110px, 1.4fr)
        84px;
    }

    .elementeditorcontainer {
      flex: 50%;
      background-color: var(--oscd-plugin-internal-base3);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      z-index: 0;
    }

    .content.dataSet {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
    }

    mwc-list-item {
      --mdc-list-item-meta-size: 48px;
    }

    data-set-element-editor {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    .copy-option-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .copy-button {
      align-self: flex-end;
    }

    .copy-optin-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .copy-option-description {
      min-width: 240px;
    }

    .copy-option-description-ied {
      font-weight: bold;
    }

    .copy-option-description-status {
      font-size: 0.8em;
    }
  `;
}

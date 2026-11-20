import { css, html, type PropertyValues, type TemplateResult } from 'lit';
import { query, state } from 'lit/decorators.js';

import { ActionList } from '@openenergytools/filterable-lists/dist/ActionList.js';
import { MdDialog } from '@scopedelement/material-web/dialog/MdDialog.js';
import { MdIcon } from '@scopedelement/material-web/icon/MdIcon.js';
import { MdIconButton } from '@scopedelement/material-web/iconbutton/MdIconButton.js';
import { MdOutlinedButton } from '@scopedelement/material-web/button/MdOutlinedButton.js';
import { MdCheckbox } from '@scopedelement/material-web/checkbox/MdCheckbox.js';

import { newEditEvent } from '@openenergytools/open-scd-core';
import { createGSEControl, identity, removeControlBlock } from '@openenergytools/scl-lib';
import { newLogEvent } from '../../foundation/log-event.js';
import { pathIdentity, styles } from '../../foundation.js';
import { PublisherLDeviceSelectDialog } from '../../shared/components/publisher-ldevice-select-dialog.js';
import {
  PublisherSelectionList,
  renderIedAddButton,
  type SelectionListGroup,
} from '../../shared/components/publisher-selection-list.js';
import { gooseAddBlock, gooseLDeviceBlock, iedLDevices } from '../add-block.js';

import { DataSetElementEditor } from '../dataset/data-set-element-editor.js';
import { GseControlEditDialog } from './gse-control-edit-dialog.js';

import {
  BaseElementEditor,
  ControlBlockCopyStatus,
} from '../base-element-editor.js';

interface GooseListGroup extends SelectionListGroup<Element> {
  ied: Element;
}

/** Same labels as the GOOSE edit dialog. A missing attribute is None. */
const gooseLDeviceMessage =
  'Choose the LDevice to which the new GOOSE will be added.';

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

/** Absent is "-". Only the stored booleans become words. */
function fixedOffsetText(control: Element): string {
  const value = control.getAttribute('fixedOffs');
  if (value === null) return '-';
  if (value === 'true') return 'True';
  if (value === 'false') return 'False';
  return value;
}

export class GseControlEditor extends BaseElementEditor {
  static scopedElements = {
    'action-list': ActionList,
    'publisher-selection-list': PublisherSelectionList,
    'data-set-element-editor': DataSetElementEditor,
    'gse-control-edit-dialog': GseControlEditDialog,
    'publisher-ldevice-select-dialog': PublisherLDeviceSelectDialog,
    'md-outlined-button': MdOutlinedButton,
    'md-icon-button': MdIconButton,
    'md-icon': MdIcon,
    'md-dialog': MdDialog,
    'md-checkbox': MdCheckbox,
  };

  @query('.change.scl.element') selectGSEControlButton!: MdOutlinedButton;

  @query('gse-control-edit-dialog')
  private gseControlEditDialog?: GseControlEditDialog;

  @query('publisher-ldevice-select-dialog')
  lDeviceSelectDialog!: PublisherLDeviceSelectDialog;

  @state()
  private lDevices: Element[] = [];

  @state()
  private selectedLDevice: Element | null = null;

  private selectedIed: Element | null = null;

  private lDevicePath = '';

  @query('data-set-element-editor')
  dataSetElementEditor!: DataSetElementEditor;

  /** Row whose picker is open. Distinct from the control shown in the detail. */
  @state()
  private connectControl?: Element;

  /** The open picker fills the GOOSE dialog instead of writing the link. */
  private stageDatasetPick = false;

  /** Drops the listener from the picker session that is about to be replaced. */
  private clearPicker?: () => void;

  /** Row whose GOOSE dialog is open. Distinct from the detail. */
  @state()
  private editControl: Element | null = null;

  @state()
  private editDataSet: Element | null = null;

  @state()
  private creating = false;

  @state()
  private pendingGse: Element | null = null;

  @state()
  private createPath = '';

  private pendingGoose: {
    iedName: string;
    inserts: { parent: Node; node: Node; reference: Node | null }[];
    control: Element;
  } | null = null;

  protected override dataSetPickerInDetail = false;

  protected override dataSetPickerControl(): Element | undefined {
    return this.connectControl ?? this.selectCtrlBlock;
  }

  protected override selectDataSet(dataSet: Element): void {
    if (this.stageDatasetPick) {
      this.stageDatasetPick = false;
      this.connectControl = undefined;
      this.gseControlEditDialog?.stageDataSet(dataSet);
      this.selectDataSetDialog.close();
      return;
    }
    const control = this.dataSetPickerControl();
    super.selectDataSet(dataSet);
    if (control && control === this.editControl) this.editDataSet = dataSet;
  }

  protected override onDocumentReplaced(): void {
    this.clearPicker?.();
    this.gseControlEditDialog?.close();
    this.lDeviceSelectDialog?.close();
    this.dataSetElementEditor?.closeOpenDialogs();
    this.connectControl = undefined;
    this.stageDatasetPick = false;
    this.creating = false;
    this.pendingGse = null;
    this.pendingGoose = null;
    this.createPath = '';
    this.editControl = null;
    this.editDataSet = null;
    this.lDevices = [];
    this.selectedLDevice = null;
    this.selectedIed = null;
    this.lDevicePath = '';
  }

  override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!changed.has('editCount') || !this.selectCtrlBlock) return;
    const next = this.getDataSet(this.selectCtrlBlock);
    if (next !== this.selectedDataSet) this.selectedDataSet = next;
  }

  protected renderElementEditorContainer(): TemplateResult {
    if (this.selectCtrlBlock !== undefined)
      return html`<div class="elementeditorcontainer">
        ${this.renderDataSetElementContainer()}
      </div>`;

    return html``;
  }

  private gooseIn(ied: Element): Element[] {
    return Array.from(
      ied.querySelectorAll(
        ':scope > AccessPoint > Server > LDevice > LN0 > GSEControl'
      )
    );
  }

  private selectionGroups(): GooseListGroup[] {
    return this.queryIEDs().map(ied => {
      const rows = this.gooseIn(ied);
      const label = ied.getAttribute('name') ?? '';
      return { id: label, label, count: rows.length, rows, ied };
    });
  }

  private gooseMatches(control: Element, query: string): boolean {
    const name = control.getAttribute('name') ?? '';
    return (
      name.toLowerCase().includes(query) ||
      pathIdentity(control).toLowerCase().includes(query)
    );
  }

  private visibleRows = (
    group: GooseListGroup,
    query: string
  ): Element[] | null => {
    if (!query) return group.rows;
    if (group.label.toLowerCase().includes(query)) return group.rows;
    const matches = group.rows.filter(control =>
      this.gooseMatches(control, query)
    );
    return matches.length > 0 ? matches : null;
  };

  private startCreateGoose(ied: Element): void {
    if (gooseAddBlock(ied)) return;
    const devices = iedLDevices(ied);
    if (devices.length === 1) {
      this.createGoose(ied, devices[0]);
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
    if (lDevice && gooseLDeviceBlock(lDevice)) return;
    this.selectedLDevice = lDevice;
  }

  private acceptLDevice(): void {
    this.lDeviceSelectDialog?.close();
    const ied = this.selectedIed;
    const lDevice = this.selectedLDevice;
    if (!ied || !lDevice || gooseLDeviceBlock(lDevice)) return;
    this.createGoose(ied, lDevice);
  }

  private createGoose(ied: Element, lDevice: Element): void {
    if (gooseAddBlock(ied) || gooseLDeviceBlock(lDevice)) return;
    const inserts = createGSEControl(lDevice);
    const controlInsert = inserts.find(
      insert => (insert.node as Element).tagName === 'GSEControl',
    );
    if (controlInsert) {
      const parent = controlInsert.parent;
      const path = identity(parent as Element);
      const gseInsert = inserts.find(
        insert => (insert.node as Element).tagName === 'GSE',
      );
      this.pendingGoose = {
        iedName: ied.getAttribute('name') ?? '',
        inserts,
        control: controlInsert.node as Element,
      };
      this.createDataSetParent = parent as Element;
      this.pendingGse = (gseInsert?.node as Element | undefined) ?? null;
      this.createPath = typeof path === 'string' ? path : '';
      this.editDataSet = null;
      this.editControl = controlInsert.node as Element;
      this.creating = true;
      void this.updateComplete.then(() => this.gseControlEditDialog?.show());
      return;
    }

    const iedName = ied.getAttribute('name');
    this.dispatchEvent(
      newLogEvent({
        title: 'Could not create GSEControl',
        kind: 'warning',
        message: `Could not create GSEControl for IED ${iedName}: an unknown validation error occurred.`,
      })
    );
  }

  private openGoose(control: Element): void {
    if (this.selectCtrlBlock === control) {
      this.gseControlEditDialog?.close();
      this.selectCtrlBlock = undefined;
      this.selectedDataSet = undefined;
      this.selectionList?.classList.remove('hidden');
      this.selectGSEControlButton.classList.add('hidden');
      return;
    }

    this.gseControlEditDialog?.close();
    if (this.dataSetElementEditor) this.dataSetElementEditor.resetInputs();

    this.selectCtrlBlock = control;
    this.selectedDataSet = this.getDataSet(control);
    this.selectionList?.classList.add('hidden');
    this.selectGSEControlButton.classList.remove('hidden');
  }

  private copyGoose(ied: Element, control: Element): void {
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

  private removeGoose(control: Element): void {
    this.gseControlEditDialog?.close();
    this.dispatchEvent(
      newEditEvent(removeControlBlock({ node: control }), {
        title: 'Remove GSEControl',
      })
    );
    this.selectCtrlBlock = undefined;
  }

  private commitGooseCreate(event: CustomEvent<{ edits?: unknown[] }>): void {
    const pending = this.pendingGoose;
    if (!pending) return;
    const extra = event.detail?.edits ?? [];
    this.creating = false;
    this.pendingGse = null;
    this.pendingGoose = null;
    this.createDataSetParent = null;
    const payload = extra.length > 0 ? [...pending.inserts, ...extra] : pending.inserts;
    this.dispatchEvent(
      newEditEvent(payload as Parameters<typeof newEditEvent>[0], {
        title: 'Create New GSEControl',
      }),
    );
    this.selectionList?.openGroup(pending.iedName);
    this.openGoose(pending.control);
  }

  private cancelGooseCreate(): void {
    this.creating = false;
    this.pendingGse = null;
    this.pendingGoose = null;
    this.createDataSetParent = null;
    this.editControl = null;
    this.editDataSet = null;
  }

  /** Opens the GOOSE dialog for this row and leaves the detail closed. */
  private editGoose(control: Element): void {
    this.creating = false;
    this.pendingGse = null;
    this.pendingGoose = null;
    this.createDataSetParent = null;
    this.editControl = control;
    this.editDataSet = this.getDataSet(control);
    void this.updateComplete.then(() => {
      void this.gseControlEditDialog?.show();
    });
  }

  /**
   * Opens the dataset picker for this row and leaves the detail closed.
   * `stage` keeps the choice in the GOOSE dialog until Save changes.
   */
  private connectGoose(control: Element, stage = false): void {
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

  private renderGroupAction = (group: GooseListGroup): TemplateResult =>
    renderIedAddButton('Add GOOSE', gooseAddBlock(group.ied), () =>
      this.startCreateGoose(group.ied),
    );

  private renderGooseHeader = (): TemplateResult => html`
    <span class="clip">Name</span>
    <span class="clip">Connected Data Set</span>
    <span class="clip narrow-hide">confRev</span>
    <span class="clip narrow-hide">Type</span>
    <span class="clip narrow-hide">Security</span>
    <span class="clip narrow-hide">Fixed Offset</span>
    <span class="actions"></span>
  `;

  private renderGooseRow = (
    group: GooseListGroup,
    control: Element
  ): TemplateResult => {
    const name = control.getAttribute('name') ?? '';
    const dataSetName = control.getAttribute('datSet');
    const linkedDataSet = dataSetName ? this.getDataSet(control) : null;
    const selected = this.selectCtrlBlock === control;
    return html`<div
      class="dataset-row ${selected ? 'selected' : ''}"
      @click=${() => this.openGoose(control)}
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
                  this.connectGoose(control);
                }}
                >Connect<md-icon slot="icon">link</md-icon></md-filled-button
              >`}
        ${this.renderDataSetDisconnect(control)}
      </span>
      <span class="cell clip conf-rev narrow-hide"
        >${absentDash(control.getAttribute('confRev'))}</span
      >
      <span class="cell clip type narrow-hide"
        >${absentDash(control.getAttribute('type'))}</span
      >
      <span class="cell clip security narrow-hide">${securityText(control)}</span>
      <span class="cell clip fixed-offset narrow-hide"
        >${fixedOffsetText(control)}</span
      >
      <span class="dataset-actions">
        <button
          type="button"
          class="icon-button dataset-edit"
          aria-label="Edit GSEControl"
          title="Edit GSEControl"
          @click=${(event: Event) => {
            event.stopPropagation();
            this.editGoose(control);
          }}
        >
          <md-icon aria-hidden="true">edit</md-icon>
        </button>
        <button
          type="button"
          class="icon-button dataset-copy"
          aria-label="Copy GOOSE"
          title="Copy GOOSE"
          @click=${(event: Event) => {
            event.stopPropagation();
            this.copyGoose(group.ied, control);
          }}
        >
          <md-icon aria-hidden="true">folder_copy</md-icon>
        </button>
        <button
          type="button"
          class="icon-button dataset-delete"
          aria-label="Remove GOOSE"
          title="Remove GOOSE"
          @click=${(event: Event) => {
            event.stopPropagation();
            this.removeGoose(control);
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
        .searchPlaceholder=${'Search GOOSE Controls'}
        .groups=${this.selectionGroups()}
        .searchValue=${this.searchValue}
        .visibleRows=${this.visibleRows}
        .renderHeader=${this.renderGooseHeader}
        .renderRow=${this.renderGooseRow}
        .renderGroupAction=${this.renderGroupAction}
      ></publisher-selection-list>`;
  }

  private renderToggleButton(): TemplateResult {
    return html`<md-outlined-button
      class="change scl element"
      @click=${() => {
        this.selectionList?.classList.remove('hidden');
        this.selectGSEControlButton.classList.add('hidden');
      }}
      >Selected GOOSE</md-outlined-button
    >`;
  }

  render(): TemplateResult {
    if (!this.doc) return html`No SCL loaded`;

    return html`${this.renderToggleButton()}
      ${this.renderSelectDataSetDialog()}
      <gse-control-edit-dialog
        .control=${this.editControl}
        .dataSet=${this.editDataSet}
        .editCount=${this.editCount}
        .creating=${this.creating}
        .pendingGse=${this.pendingGse}
        .createPath=${this.createPath}
        @create-accept=${(event: CustomEvent<{ edits?: unknown[] }>) =>
          this.commitGooseCreate(event)}
        @create-cancel=${() => this.cancelGooseCreate()}
        @change-dataset=${() => {
          if (this.editControl) this.connectGoose(this.editControl, true);
        }}
      ></gse-control-edit-dialog>
      <publisher-ldevice-select-dialog
        .lDevices=${this.lDevices}
        .path=${this.lDevicePath}
        .selected=${this.selectedLDevice}
        .message=${gooseLDeviceMessage}
        .blockReason=${gooseLDeviceBlock}
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
        minmax(120px, 1.5fr)
        minmax(168px, 1.7fr)
        minmax(72px, 0.7fr)
        minmax(64px, 0.6fr)
        minmax(150px, 1.5fr)
        minmax(88px, 0.8fr)
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

    data-set-element-editor {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    mwc-list-item {
      --mdc-list-item-meta-size: 48px;
    }

    md-icon-button[icon='playlist_add'] {
      pointer-events: all;
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

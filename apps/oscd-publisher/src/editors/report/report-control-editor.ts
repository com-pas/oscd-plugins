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
  createReportControl,
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
import { iedLDevices, reportAddBlock, reportLDeviceBlock, reportUsage } from '../add-block.js';

import { DataSetElementEditor } from '../dataset/data-set-element-editor.js';
import { ReportControlEditDialog } from './report-control-edit-dialog.js';
import {
  BaseElementEditor,
  ControlBlockCopyStatus,
} from '../base-element-editor.js';

interface ReportListGroup extends SelectionListGroup<Element> {
  ied: Element;
}

const reportLDeviceMessage =
  'Choose the LDevice to which the new Report will be added.';

/** Absent attribute is "-". An empty string stays empty. */
function absentDash(value: string | null): string {
  return value === null ? '-' : value;
}

/** Absent is "-". Only the stored booleans become words. */
function lockedBool(value: string | null): string {
  if (value === null) return '-';
  if (value === 'true') return 'True';
  if (value === 'false') return 'False';
  return value;
}

/** Buffered has no lock. A missing attribute is false. */
function bufferedText(control: Element): string {
  return control.getAttribute('buffered') === 'true' ? 'True' : 'False';
}

/** ClientLN count against RptEnabled@max. A missing max is 1. */
function clientsText(report: Element): string {
  const numberClientLNs = report.getElementsByTagName('ClientLN').length;
  const max = Number(report.querySelector('RptEnabled')?.getAttribute('max'));
  return max ? `${numberClientLNs}/${max}` : `${numberClientLNs}/1`;
}

export class ReportControlEditor extends BaseElementEditor {
  static scopedElements = {
    'action-list': ActionList,
    'publisher-selection-list': PublisherSelectionList,
    'data-set-element-editor': DataSetElementEditor,
    'md-outlined-button': MdOutlinedButton,
    'report-control-edit-dialog': ReportControlEditDialog,
    'publisher-ldevice-select-dialog': PublisherLDeviceSelectDialog,
    'md-icon-button': MdIconButton,
    'md-icon': MdIcon,
    'md-dialog': MdDialog,
    'md-checkbox': MdCheckbox,
  };

  @query('.selectionlist')
  selectionList!: PublisherSelectionList<Element>;

  @query('.change.scl.element') selectReportControlButton!: MdOutlinedButton;

  @query('data-set-element-editor')
  dataSetElementEditor!: DataSetElementEditor;

  @query('report-control-edit-dialog')
  private reportEditDialog?: ReportControlEditDialog;

  @query('publisher-ldevice-select-dialog')
  lDeviceSelectDialog!: PublisherLDeviceSelectDialog;

  @state()
  private lDevices: Element[] = [];

  @state()
  private selectedLDevice: Element | null = null;

  private selectedIed: Element | null = null;

  private lDevicePath = '';

  /** Row whose report dialog is open. Distinct from the detail. */
  @state()
  private editControl: Element | null = null;

  @state()
  private editDataSet: Element | null = null;

  @state()
  private creating = false;

  @state()
  private createPath = '';

  private pendingReport: {
    iedName: string;
    insert: { parent: Node; node: Node; reference: Node | null };
    control: Element;
  } | null = null;

  /** The picker stays at the root so Change data set works before the detail exists. */
  protected override dataSetPickerInDetail = false;

  /** Row whose picker is open. Distinct from the control shown in the detail. */
  @state()
  private connectControl?: Element;

  private stageDatasetPick = false;

  /** Drops the listener from the picker session that is about to be replaced. */
  private clearPicker?: () => void;

  protected override onDocumentReplaced(): void {
    this.clearPicker?.();
    this.reportEditDialog?.close();
    this.lDeviceSelectDialog?.close();
    this.dataSetElementEditor?.closeOpenDialogs();
    this.connectControl = undefined;
    this.stageDatasetPick = false;
    this.creating = false;
    this.createPath = '';
    this.pendingReport = null;
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
      this.reportEditDialog?.stageDataSet(dataSet);
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

  private reportsIn(ied: Element): Element[] {
    return Array.from(
      ied.querySelectorAll(
        ':scope > AccessPoint > Server > LDevice > LN0 > ReportControl, :scope > AccessPoint > Server > LDevice > LN > ReportControl'
      )
    );
  }

  private selectionGroups(): ReportListGroup[] {
    return this.queryIEDs().map(ied => {
      const rows = this.reportsIn(ied);
      const label = ied.getAttribute('name') ?? '';
      const usage = reportUsage(ied);
      const countNote =
        usage.max === null ? undefined : `${usage.instances} of ${usage.max} max-clients`;
      return { id: label, label, count: rows.length, countNote, rows, ied };
    });
  }

  private reportMatches(report: Element, query: string): boolean {
    const name = report.getAttribute('name') ?? '';
    return (
      name.toLowerCase().includes(query) ||
      pathIdentity(report).toLowerCase().includes(query)
    );
  }

  private visibleRows = (
    group: ReportListGroup,
    query: string
  ): Element[] | null => {
    if (!query) return group.rows;
    if (group.label.toLowerCase().includes(query)) return group.rows;
    const matches = group.rows.filter(report =>
      this.reportMatches(report, query)
    );
    return matches.length > 0 ? matches : null;
  };

  private startCreateReport(ied: Element): void {
    if (reportAddBlock(ied)) return;
    const devices = iedLDevices(ied);
    if (devices.length === 1) {
      this.createReport(ied, devices[0]);
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
    if (lDevice && reportLDeviceBlock(lDevice)) return;
    this.selectedLDevice = lDevice;
  }

  private acceptLDevice(): void {
    this.lDeviceSelectDialog?.close();
    const ied = this.selectedIed;
    const lDevice = this.selectedLDevice;
    if (!ied || !lDevice || reportLDeviceBlock(lDevice)) return;
    this.createReport(ied, lDevice);
  }

  private createReport(ied: Element, lDevice: Element): void {
    if (reportAddBlock(ied) || reportLDeviceBlock(lDevice)) return;
    const insert = createReportControl(lDevice);
    if (insert) {
      const parent = insert.parent;
      const path = identity(parent as Element);
      this.pendingReport = {
        iedName: ied.getAttribute('name') ?? '',
        insert,
        control: insert.node as Element,
      };
      this.createDataSetParent = parent as Element;
      this.createPath = typeof path === 'string' ? path : '';
      this.editDataSet = null;
      this.editControl = insert.node as Element;
      this.creating = true;
      void this.updateComplete.then(() => this.reportEditDialog?.show());
      return;
    }

    const iedName = ied.getAttribute('name');
    this.dispatchEvent(
      newLogEvent({
        title: 'Could not create ReportControl',
        kind: 'warning',
        message: `Could not create ReportControl for IED ${iedName}.`,
      })
    );
  }

  private openReport(report: Element): void {
    if (this.selectCtrlBlock === report) {
      this.reportEditDialog?.close();
      this.selectCtrlBlock = undefined;
      this.selectedDataSet = undefined;
      this.selectionList.classList.remove('hidden');
      this.selectReportControlButton.classList.add('hidden');
      return;
    }

    this.reportEditDialog?.close();
    if (this.dataSetElementEditor) this.dataSetElementEditor.resetInputs();

    this.selectCtrlBlock = report;
    this.selectedDataSet = this.getDataSet(report);
    this.selectionList.classList.add('hidden');
    this.selectReportControlButton.classList.remove('hidden');
  }

  private copyReport(ied: Element, report: Element): void {
    const lDevice = report.closest('LDevice');
    if (!lDevice) throw new Error('ReportControl has no LDevice parent');

    this.controlBlockCopyOptions = this.queryIEDs()
      .filter(otherIED => ied !== otherIED)
      .map(otherIED => {
        const status = this.getCopyControlBlockCopyStatus(report, otherIED);
        return {
          ied: otherIED,
          control: report,
          status,
          selected: status === ControlBlockCopyStatus.CanCopy,
        };
      });
    this.copyControlBlockDialog.show();
  }

  private removeReport(report: Element): void {
    this.reportEditDialog?.close();
    this.dispatchEvent(
      newEditEvent(removeControlBlock({ node: report }), {
        title: `Remove ReportControl ${report}`,
      })
    );
    this.selectCtrlBlock = undefined;
  }

  private renderGroupAction = (group: ReportListGroup): TemplateResult =>
    renderIedAddButton('Add Report', reportAddBlock(group.ied), () =>
      this.startCreateReport(group.ied),
    );

  private renderReportHeader = (): TemplateResult => html`
    <span class="clip">Report Control</span>
    <span class="clip">Connected Data Set</span>
    <span class="clip narrow-hide">Clients</span>
    <span class="clip narrow-hide">confRev</span>
    <span class="clip narrow-hide">Buffered</span>
    <span class="clip narrow-hide">Buffer Time</span>
    <span class="clip narrow-hide">Indexed</span>
    <span class="clip narrow-hide">intgPd</span>
    <span class="clip narrow-hide">Report Control ID</span>
    <span class="actions"></span>
  `;

  private renderReportRow = (
    group: ReportListGroup,
    report: Element
  ): TemplateResult => {
    const name = report.getAttribute('name') ?? '';
    const dataSetName = report.getAttribute('datSet');
    const linkedDataSet = dataSetName ? this.getDataSet(report) : null;
    const selected = this.selectCtrlBlock === report;
    return html`<div
      class="dataset-row ${selected ? 'selected' : ''}"
      @click=${() => this.openReport(report)}
    >
      <span class="cell clip dataset-name">${name}</span>
      <span class="cell dataset-cell">
        ${linkedDataSet
          ? html`<button
              type="button"
              class="dataset-connected"
              @click=${(event: Event) => this.openLinkedDataSet(event, report)}
            >${dataSetName}</button>`
          : dataSetName
            ? html`<span class="dataset-connected">${dataSetName}</span>`
            : html`<md-filled-button
                class="connect-dataset"
                @click=${(event: Event) => {
                  event.stopPropagation();
                  this.connectReport(report);
                }}
                >Connect<md-icon slot="icon">link</md-icon></md-filled-button
              >`}
        ${this.renderDataSetDisconnect(report)}
      </span>
      <span class="cell clip clients narrow-hide">${clientsText(report)}</span>
      <span class="cell clip conf-rev narrow-hide"
        >${absentDash(report.getAttribute('confRev'))}</span
      >
      <span class="cell clip buffered narrow-hide">${bufferedText(report)}</span>
      <span class="cell clip buf-time narrow-hide"
        >${absentDash(report.getAttribute('bufTime'))}</span
      >
      <span class="cell clip indexed narrow-hide"
        >${lockedBool(report.getAttribute('indexed'))}</span
      >
      <span class="cell clip intg-pd narrow-hide"
        >${absentDash(report.getAttribute('intgPd'))}</span
      >
      <span class="cell clip rpt-id narrow-hide"
        >${absentDash(report.getAttribute('rptID'))}</span
      >
      <span class="dataset-actions">
        <button
          type="button"
          class="icon-button dataset-edit"
          aria-label="Edit Report"
          title="Edit Report"
          @click=${(event: Event) => {
            event.stopPropagation();
            this.editReport(report);
          }}
        >
          <md-icon aria-hidden="true">edit</md-icon>
        </button>
        <button
          type="button"
          class="icon-button dataset-copy"
          aria-label="Copy Report"
          title="Copy Report"
          @click=${(event: Event) => {
            event.stopPropagation();
            this.copyReport(group.ied, report);
          }}
        >
          <md-icon aria-hidden="true">folder_copy</md-icon>
        </button>
        <button
          type="button"
          class="icon-button dataset-delete"
          aria-label="Remove Report"
          title="Remove Report"
          @click=${(event: Event) => {
            event.stopPropagation();
            this.removeReport(report);
          }}
        >
          <md-icon aria-hidden="true">delete</md-icon>
        </button>
      </span>
    </div>`;
  };

  private commitReportCreate(event: CustomEvent<{ edits?: unknown[] }>): void {
    const pending = this.pendingReport;
    if (!pending) return;
    const extra = event.detail?.edits ?? [];
    this.creating = false;
    this.pendingReport = null;
    this.createDataSetParent = null;
    const payload = extra.length > 0 ? [pending.insert, ...extra] : pending.insert;
    this.dispatchEvent(
      newEditEvent(payload as Parameters<typeof newEditEvent>[0], {
        title: 'Create New ReportControl',
      }),
    );
    this.selectionList?.openGroup(pending.iedName);
    this.openReport(pending.control);
  }

  private cancelReportCreate(): void {
    this.creating = false;
    this.pendingReport = null;
    this.createDataSetParent = null;
    this.editControl = null;
    this.editDataSet = null;
  }

  /** Opens the report dialog for this row and leaves the detail closed. */
  private editReport(report: Element): void {
    this.creating = false;
    this.pendingReport = null;
    this.createDataSetParent = null;
    this.editControl = report;
    this.editDataSet = this.getDataSet(report);
    void this.updateComplete.then(() => {
      void this.reportEditDialog?.show();
    });
  }

  /**
   * Opens the dataset picker for this report.
   * `stage` keeps the choice in the report dialog until Save changes.
   */
  private connectReport(report: Element, stage = false): void {
    this.clearPicker?.();
    this.connectControl = report;
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

  private renderSelectionList(): TemplateResult {
    return html`${this.renderCopyControlBlockDialog()}
      <publisher-selection-list
        class="selectionlist"
        .columns=${true}
        .searchPlaceholder=${'Search Report Controls'}
        .groups=${this.selectionGroups()}
        .searchValue=${this.searchValue}
        .visibleRows=${this.visibleRows}
        .renderHeader=${this.renderReportHeader}
        .renderRow=${this.renderReportRow}
        .renderGroupAction=${this.renderGroupAction}
      ></publisher-selection-list>`;
  }

  private renderToggleButton(): TemplateResult {
    return html`<md-outlined-button
      class="change scl element"
      @click=${() => {
        this.selectionList.classList.remove('hidden');
        this.selectReportControlButton.classList.add('hidden');
      }}
      >Select Report</md-outlined-button
    >`;
  }

  render(): TemplateResult {
    if (!this.doc) return html`No SCL loaded`;

    return html`${this.renderToggleButton()}
      ${this.renderSelectDataSetDialog()}
      <report-control-edit-dialog
        .control=${this.editControl}
        .dataSet=${this.editDataSet}
        .editCount=${this.editCount}
        .creating=${this.creating}
        .createPath=${this.createPath}
        @create-accept=${(event: CustomEvent<{ edits?: unknown[] }>) =>
          this.commitReportCreate(event)}
        @create-cancel=${() => this.cancelReportCreate()}
        @change-dataset=${() => {
          if (this.editControl) this.connectReport(this.editControl, true);
        }}
      ></report-control-edit-dialog>
      <publisher-ldevice-select-dialog
        .lDevices=${this.lDevices}
        .path=${this.lDevicePath}
        .selected=${this.selectedLDevice}
        .message=${reportLDeviceMessage}
        .blockReason=${reportLDeviceBlock}
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
        minmax(130px, 1.6fr)
        minmax(130px, 1.7fr)
        minmax(64px, 0.7fr)
        minmax(60px, 0.7fr)
        minmax(60px, 0.7fr)
        minmax(80px, 0.8fr)
        minmax(60px, 0.6fr)
        minmax(60px, 0.6fr)
        minmax(120px, 1.6fr)
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

    md-icon-button[icon='playlist_add'] {
      pointer-events: all;
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

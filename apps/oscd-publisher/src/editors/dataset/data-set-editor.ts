import {
  css,
  html,
  LitElement,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { property, query, state } from 'lit/decorators.js';

import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

import { MdOutlinedButton } from '@scopedelement/material-web/button/MdOutlinedButton.js';
import { MdCheckbox } from '@scopedelement/material-web/checkbox/MdCheckbox.js';

import { newEditEvent } from '@openenergytools/open-scd-core';
import { newLogEvent } from '../../foundation/log-event.js';
import { createDataSet, getReference, identity, removeDataSet } from '@openenergytools/scl-lib';

import { MdDialog } from '@scopedelement/material-web/dialog/MdDialog.js';
import { MdIcon } from '@scopedelement/material-web/icon/MdIcon.js';
import {
  copyIncompatibilityTitle,
  isFCDACompatibleWithIED,
  queryLDevice,
  queryLN,
} from '../../foundation/utils/xml.js';
import { pathIdentity, styles } from '../../foundation.js';
import { PublisherLDeviceSelectDialog } from '../../shared/components/publisher-ldevice-select-dialog.js';
import {
  PublisherSelectionList,
  renderIedAddButton,
  type SelectionListGroup,
} from '../../shared/components/publisher-selection-list.js';
import { dataSetAddBlock, dataSetLDeviceBlock, iedLDevices } from '../add-block.js';
import { DataSetElementEditor } from './data-set-element-editor.js';
import { DataSetEditDialog } from './data-set-edit-dialog.js';

// eslint-disable-next-line no-shadow
enum DataSetCopyStatus {
  CanCopy = 'CanCopy',
  IEDStructureIncompatible = 'IEDStructureIncompatible',
  DataSetAlreadyExists = 'DataSetAlreadyExists',
}

interface DataSetCopyOption {
  ied: Element;
  dataSet: Element; // source DataSet being copied
  status: DataSetCopyStatus;
  selected: boolean;
}

interface DataSetListGroup extends SelectionListGroup<Element> {
  ied: Element;
}

export class DataSetEditor extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'data-set-element-editor': DataSetElementEditor,
    'data-set-edit-dialog': DataSetEditDialog,
    'publisher-ldevice-select-dialog': PublisherLDeviceSelectDialog,
    'md-outlined-button': MdOutlinedButton,
    'md-dialog': MdDialog,
    'md-icon': MdIcon,
    'md-checkbox': MdCheckbox,
    'publisher-selection-list': PublisherSelectionList,
  };

  /** The document being edited as provided to plugins by [[`OpenSCD`]]. */
  @property({ attribute: false })
  doc!: XMLDocument;

  /** SCL change indicator */
  @property({ type: Number })
  editCount = 0;

  @property({ type: String }) searchValue = '';

  /** Set by the plugin when a control list opens this data set. */
  @property({ attribute: false })
  focusDataSet: Element | null = null;

  @state()
  selectedDataSet?: Element;

  @state()
  lDevices: Element[] = []; // lDevices of the currently selected IED, used for the LDevice select dialog

  @state()
  selectedLDevice: Element | null = null;

  @state()
  selectedIed: Element | null = null;

  @query('publisher-selection-list')
  selectionList!: PublisherSelectionList<Element>;

  @query('.change.scl.element') selectDataSetButton!: MdOutlinedButton;

  @query('data-set-element-editor')
  dataSetElementEditor!: DataSetElementEditor;

  @query('publisher-ldevice-select-dialog')
  lDeviceSelectDialog!: PublisherLDeviceSelectDialog;

  /** Identity of the IED shown in the LDevice dialog header. */
  private lDevicePath = '';

  @query('.dialog.copy-dataset') copyDataSetDialog!: MdDialog;

  @state()
  dataSetCopyOptions: DataSetCopyOption[] = [];

  /** DataSet scl-lib built and the dialog has not accepted yet. */
  @state()
  private pendingDataSet: {
    parent: Node;
    node: Node;
    reference: Node | null;
  } | null = null;

  private pendingIedName = '';

  @query('data-set-edit-dialog')
  private createDialog?: DataSetEditDialog;

  get hasCopyDataSetSelected(): boolean {
    return this.dataSetCopyOptions.some(o => o.selected);
  }

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('doc') && changed.get('doc') != null) this.dropDocumentSelection();
  }

  override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!changed.has('focusDataSet') || !this.focusDataSet || !this.selectionList) {
      return;
    }
    this.openDataSet(this.focusDataSet);
    this.dispatchEvent(
      new CustomEvent('dataset-opened', { bubbles: true, composed: true })
    );
  }

  /** Drops the open DataSet when the host replaces the SCL document. */
  private dropDocumentSelection(): void {
    this.dataSetElementEditor?.closeOpenDialogs();
    this.createDialog?.close();
    this.lDeviceSelectDialog?.close();
    if (this.copyDataSetDialog?.open) this.copyDataSetDialog.close();
    this.selectionList?.classList.remove('hidden');
    this.selectDataSetButton?.classList.add('hidden');
    this.selectedDataSet = undefined;
    this.pendingDataSet = null;
    this.pendingIedName = '';
    this.dataSetCopyOptions = [];
    this.lDevices = [];
    this.selectedLDevice = null;
    this.selectedIed = null;
    this.lDevicePath = '';
  }

  /**
   * Finds the equivalent LN (or LN0) in the target IED that mirrors the
   * LDevice+LN hierarchy where the given DataSet resides.
   * Returns null when the target IED lacks the matching structure.
   */
  // eslint-disable-next-line class-methods-use-this
  private queryLnForDataSet(ied: Element, dataSet: Element): Element | null {
    const lDevice = dataSet.closest('LDevice');
    const lnOrLn0 = dataSet.parentElement;
    if (!lnOrLn0 || !lDevice) return null;

    const lDeviceInIed = queryLDevice(ied, lDevice.getAttribute('inst') ?? '');
    if (!lDeviceInIed) return null;

    return queryLN(
      lDeviceInIed,
      lnOrLn0.getAttribute('lnClass') ?? '',
      lnOrLn0.getAttribute('inst') ?? '',
      lnOrLn0.getAttribute('prefix')
    );
  }

  /**
   * Determines copy compatibility of a DataSet with a target IED.
   * Checks: matching LDevice+LN path, no name conflict, all FCDAs valid.
   */
  // eslint-disable-next-line class-methods-use-this
  private getDataSetCopyStatus(
    dataSet: Element,
    otherIED: Element
  ): DataSetCopyStatus {
    const ln = this.queryLnForDataSet(otherIED, dataSet);
    if (!ln) return DataSetCopyStatus.IEDStructureIncompatible;

    if (ln.querySelector(`DataSet[name="${dataSet.getAttribute('name')}"]`))
      return DataSetCopyStatus.DataSetAlreadyExists;

    for (const fcda of Array.from(dataSet.querySelectorAll('FCDA'))) {
      if (!isFCDACompatibleWithIED(fcda, otherIED))
        return DataSetCopyStatus.IEDStructureIncompatible;
    }

    return DataSetCopyStatus.CanCopy;
  }

  // eslint-disable-next-line class-methods-use-this
  private getCopyStatusText(status: DataSetCopyStatus): string {
    switch (status) {
      case DataSetCopyStatus.CanCopy:
        return 'Copy possible';
      case DataSetCopyStatus.IEDStructureIncompatible:
        return 'IED structure incompatible';
      case DataSetCopyStatus.DataSetAlreadyExists:
        return 'DataSet already exists';
      default:
        return '';
    }
  }

  private copyMismatchTitle(option: DataSetCopyOption): string {
    if (option.status !== DataSetCopyStatus.IEDStructureIncompatible) return '';
    const host = option.dataSet.parentElement;
    const lDevice = option.dataSet.closest('LDevice');
    return copyIncompatibilityTitle(
      option.ied,
      {
        ldInst: lDevice?.getAttribute('inst') ?? '',
        lnClass: host?.getAttribute('lnClass') ?? '',
        inst: host?.getAttribute('inst') ?? '',
        prefix: host?.getAttribute('prefix') ?? null,
      },
      Array.from(option.dataSet.querySelectorAll('FCDA')),
    );
  }

  private copyDataSet(): void {
    const selectedOptions = this.dataSetCopyOptions.filter(o => o.selected);
    if (selectedOptions.length === 0) {
      this.copyDataSetDialog.close();
      return;
    }

    // All options share the same source DataSet
    const { dataSet } = selectedOptions[0];

    const inserts = selectedOptions.map(o => {
      const ln = this.queryLnForDataSet(o.ied, dataSet);
      if (!ln) throw new Error('Target LN not found during DataSet copy');
      return {
        parent: ln,
        node: dataSet.cloneNode(true) as Element,
        reference: getReference(ln, 'DataSet'),
      };
    });

    this.dispatchEvent(
      newEditEvent(inserts, {
        title: `Copy DataSet to ${selectedOptions.length} IED${
          selectedOptions.length > 1 ? 's' : ''
        }`,
      })
    );

    this.copyDataSetDialog.close();
  }

  private renderCopyDataSetDialog(): TemplateResult {
    return html`<md-dialog
      class="dialog copy-dataset"
      @close=${() => {
        this.dataSetCopyOptions = [];
      }}
    >
      <div slot="content" class="copy-option-list">
        ${this.dataSetCopyOptions.map(
          option =>
            html` <label class="copy-optin-row">
              <div class="copy-option-description">
                <div class="copy-option-description-ied">
                  ${option.ied.getAttribute('name')}
                </div>
                <div
                  class="copy-option-description-status"
                  title=${this.copyMismatchTitle(option)}
                >
                  ${this.getCopyStatusText(option.status)}
                </div>
              </div>
              <md-checkbox
                ?checked=${option.selected}
                @change=${() => {
                  // eslint-disable-next-line no-param-reassign
                  option.selected = !option.selected;
                  this.requestUpdate();
                }}
                ?disabled=${option.status !== DataSetCopyStatus.CanCopy}
              >
              </md-checkbox>
            </label>`
        )}
        <div class="copy-button">
          <md-outlined-button @click=${() => this.copyDataSetDialog.close()}
            >Close</md-outlined-button
          >
          <md-outlined-button
            @click=${this.copyDataSet}
            ?disabled=${!this.hasCopyDataSetSelected}
            >Copy</md-outlined-button
          >
        </div>
      </div>
    </md-dialog>`;
  }

  private renderElementEditorContainer(): TemplateResult {
    if (this.selectedDataSet)
      return html`<div class="elementeditorcontainer">
        <data-set-element-editor
          .element=${this.selectedDataSet}
          editCount="${this.editCount}"
        ></data-set-element-editor>
      </div>`;

    return html``;
  }

  private dataSetsIn(ied: Element): Element[] {
    return Array.from(
      ied.querySelectorAll(
        ':scope > AccessPoint > Server > LDevice > LN0 > DataSet, :scope > AccessPoint > Server > LDevice > LN > DataSet'
      )
    );
  }

  private dataSetMatches(dataSet: Element, query: string): boolean {
    const name = dataSet.getAttribute('name') ?? '';
    return (
      name.toLowerCase().includes(query) ||
      pathIdentity(dataSet).toLowerCase().includes(query)
    );
  }

  private visibleRows = (
    group: DataSetListGroup,
    query: string
  ): Element[] | null => {
    if (!query) return group.rows;
    if (group.label.toLowerCase().includes(query)) return group.rows;
    const matches = group.rows.filter(dataSet =>
      this.dataSetMatches(dataSet, query)
    );
    return matches.length > 0 ? matches : null;
  };

  private dataSetUsage(dataSet: Element): {
    reports: number;
    goose: number;
    sampled: number;
  } {
    const parent = dataSet.parentElement;
    const name = dataSet.getAttribute('name') ?? '';
    if (!parent || !name) return { reports: 0, goose: 0, sampled: 0 };

    const count = (tag: string) =>
      Array.from(parent.children).filter(
        child => child.tagName === tag && child.getAttribute('datSet') === name
      ).length;

    return {
      reports: count('ReportControl'),
      goose: count('GSEControl'),
      sampled: count('SampledValueControl'),
    };
  }

  private startCreateDataSet(ied: Element): void {
    if (dataSetAddBlock(ied)) return;
    this.selectedIed = ied;
    const devices = iedLDevices(ied);
    if (devices.length === 1) {
      this.createDataSet(ied, devices[0]);
    } else {
      const id = identity(ied);
      this.lDevicePath = typeof id === 'string' ? id : '';
      this.selectedLDevice = null;
      this.lDevices = devices;
      void this.updateComplete.then(() => this.lDeviceSelectDialog?.show());
    }
  }

  private openDataSet(dataSet: Element): void {
    if (this.selectedDataSet === dataSet) {
      if (this.dataSetElementEditor) this.dataSetElementEditor.resetInputs();
      this.selectedDataSet = undefined;
      this.selectionList.classList.remove('hidden');
      this.selectDataSetButton.classList.add('hidden');
      return;
    }

    if (this.dataSetElementEditor) this.dataSetElementEditor.resetInputs();

    this.selectedDataSet = dataSet;
    this.selectionList.classList.add('hidden');
    this.selectDataSetButton.classList.remove('hidden');
  }

  private copyDataSetFrom(ied: Element, dataSet: Element): void {
    this.dataSetCopyOptions = Array.from(
      this.doc.querySelectorAll(':root > IED')
    )
      .filter(otherIed => otherIed !== ied)
      .map(otherIed => {
        const status = this.getDataSetCopyStatus(dataSet, otherIed);
        return {
          ied: otherIed,
          dataSet,
          status,
          selected: status === DataSetCopyStatus.CanCopy,
        };
      });

    this.copyDataSetDialog.show();
  }

  private removeSelectedDataSet(dataSet: Element): void {
    this.dispatchEvent(
      newEditEvent(removeDataSet({ node: dataSet }), {
        title: 'Remove DataSet',
      })
    );
    this.selectedDataSet = undefined;
  }

  private renderUsage(dataSet: Element): TemplateResult {
    const { reports, goose, sampled } = this.dataSetUsage(dataSet);
    if (!reports && !goose && !sampled) {
      return html`<span class="chip chip-none">Not connected</span>`;
    }

    return html`${reports
      ? html`<span class="chip"
          >${reports} Report${reports === 1 ? '' : 's'}</span
        >`
      : ''}
    ${goose ? html`<span class="chip">${goose} GOOSE</span>` : ''}
    ${sampled
      ? html`<span class="chip"
          >${sampled} Sampled Value${sampled === 1 ? '' : 's'}</span
        >`
      : ''}`;
  }

  private renderGroupAction = (group: DataSetListGroup): TemplateResult =>
    renderIedAddButton('Add DataSet', dataSetAddBlock(group.ied), () =>
      this.startCreateDataSet(group.ied),
    );

  private renderDataSetRow = (
    group: DataSetListGroup,
    dataSet: Element
  ): TemplateResult => {
    const name = dataSet.getAttribute('name') ?? '';
    const selected = this.selectedDataSet === dataSet;

    return html`<div
      class="dataset-row ${selected ? 'selected' : ''}"
      @click=${() => this.openDataSet(dataSet)}
    >
      <span class="dataset-label">
        <span class="dataset-name">${name}</span>
        <span class="dataset-path">${pathIdentity(dataSet)}</span>
      </span>
      <span class="dataset-chips">${this.renderUsage(dataSet)}</span>
      <span class="dataset-actions">
        <button
          type="button"
          class="icon-button dataset-copy"
          aria-label="Copy DataSet"
          title="Copy DataSet"
          @click=${(event: Event) => {
            event.stopPropagation();
            this.copyDataSetFrom(group.ied, dataSet);
          }}
        >
          <md-icon aria-hidden="true">folder_copy</md-icon>
        </button>
        <button
          type="button"
          class="icon-button dataset-delete"
          aria-label="Remove DataSet"
          title="Remove DataSet"
          @click=${(event: Event) => {
            event.stopPropagation();
            this.removeSelectedDataSet(dataSet);
          }}
        >
          <md-icon aria-hidden="true">delete</md-icon>
        </button>
      </span>
    </div>`;
  };

  private selectionGroups(): DataSetListGroup[] {
    return Array.from(this.doc.querySelectorAll(':root > IED')).map(ied => {
      const rows = this.dataSetsIn(ied);
      const label = ied.getAttribute('name') ?? '';
      return { id: label, label, count: rows.length, rows, ied };
    });
  }

  private renderSelectionList(): TemplateResult {
    return html`<publisher-selection-list
      class="selectionlist"
      .groups=${this.selectionGroups()}
      .searchValue=${this.searchValue}
      .initialOpenId=${this.focusDataSet?.closest('IED')?.getAttribute('name') ?? ''}
      .visibleRows=${this.visibleRows}
      .renderRow=${this.renderDataSetRow}
      .renderGroupAction=${this.renderGroupAction}
      @search-change=${(event: CustomEvent<string>) => {
        this.searchValue = event.detail;
      }}
    ></publisher-selection-list>`;
  }

  private createDataSet(ied: Element, targetLDevice: Element): void {
    if (!targetLDevice) return;
    const ln0 = targetLDevice.querySelector(':scope > LN0');
    if (!ln0) return;

    const insertDataSet = createDataSet(ln0);
    if (insertDataSet) {
      this.pendingIedName = ied.getAttribute('name') ?? '';
      this.pendingDataSet = insertDataSet;
      void this.updateComplete.then(() => this.createDialog?.show());
    } else {
      const iedName = ied.getAttribute('name');
      let reason: string;
      const anyLn = ied.querySelector('LN0, LN');
      if (!anyLn) {
        reason = 'it has no LN0 or LN element';
      } else {
        reason = 'an unknown validation error occurred';
      }

      this.dispatchEvent(
        newLogEvent({
          title: 'Could not create DataSet',
          message: `The DataSet could not be created in IED '${iedName}' because ${reason}.`,
          kind: 'warning',
        })
      );
    }
  }

  private commitDataSetCreate(): void {
    const insert = this.pendingDataSet;
    const iedName = this.pendingIedName;
    if (!insert) return;
    this.pendingDataSet = null;
    this.dispatchEvent(
      newEditEvent(insert, { title: 'Create New DataSet' }),
    );
    this.selectionList?.openGroup(iedName);
    this.openDataSet(insert.node as Element);
  }

  private renderToggleButton(): TemplateResult {
    return html`<md-outlined-button
      class="change scl element"
      @click=${() => {
        this.selectionList.classList.remove('hidden');
        this.selectDataSetButton.classList.add('hidden');
      }}
      >Select DataSet</md-outlined-button
    >`;
  }

  private selectLDevice(ld: Element | null): void {
    if (ld && dataSetLDeviceBlock(ld)) return;
    this.selectedLDevice = ld;
  }

  private handleLDeviceSelect(): void {
    this.lDeviceSelectDialog?.close();
    if (!this.selectedLDevice || !this.selectedIed) return;
    if (dataSetLDeviceBlock(this.selectedLDevice)) return;
    this.createDataSet(this.selectedIed, this.selectedLDevice);
  }

  render(): TemplateResult {
    if (!this.doc) return html`<div>No SCL loaded</div>`;

    const pendingNode = (this.pendingDataSet?.node as Element | undefined) ?? null;
    const pendingParent = this.pendingDataSet?.parent;
    const pendingPath = pendingParent ? identity(pendingParent as Element) : '';

    return html`${this.renderToggleButton()}
      ${this.renderCopyDataSetDialog()}
      <data-set-edit-dialog
        .element=${pendingNode}
        .creating=${pendingNode !== null}
        .createPath=${typeof pendingPath === 'string' ? pendingPath : ''}
        .nameParent=${pendingParent instanceof Element ? pendingParent : null}
        @create-accept=${() => this.commitDataSetCreate()}
        @create-cancel=${() => {
          this.pendingDataSet = null;
        }}
      ></data-set-edit-dialog>
      <publisher-ldevice-select-dialog
        .lDevices=${this.lDevices}
        .path=${this.lDevicePath}
        .selected=${this.selectedLDevice}
        .message=${'Choose the LDevice to which the new DataSet will be added.'}
        .blockReason=${dataSetLDeviceBlock}
        @ldevice-change=${(event: CustomEvent<Element>) => this.selectLDevice(event.detail)}
        @ldevice-accept=${() => this.handleLDeviceSelect()}
      ></publisher-ldevice-select-dialog>
      <div class="section">
        ${this.renderSelectionList()}${this.renderElementEditorContainer()}
      </div>`;
  }

  static styles = css`
    ${styles}

    data-set-element-editor {
      flex: auto;
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

    .selectionlist {
      display: flex;
      flex: 35 1 0%;
      flex-direction: column;
      min-width: 0;
      padding: 0;
    }

    .elementeditorcontainer {
      flex: 65 1 0%;
      min-width: 0;
    }
  `;
}

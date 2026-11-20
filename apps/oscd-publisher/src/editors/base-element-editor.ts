import { LitElement, html, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';

import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

import { MdDialog } from '@scopedelement/material-web/dialog/MdDialog.js';
import type { MdIconButton } from '@scopedelement/material-web/iconbutton/MdIconButton.js';

import { newEditEvent } from '@openenergytools/open-scd-core';
import { createDataSet, getReference, identity } from '@openenergytools/scl-lib';
import '@openenergytools/filterable-lists/dist/action-list.js';

import {
  dataSetLinkLocked,
  subscribedDataSetTitle,
} from './dataset-link-lock.js';
import type { PublisherSelectionList } from '../shared/components/publisher-selection-list.js';
import {
  copyIncompatibilityTitle,
  isFCDACompatibleWithIED,
  queryLDevice,
  queryLN,
} from '../foundation/utils/xml.js';

// eslint-disable-next-line no-shadow
export enum ControlBlockCopyStatus {
  CanCopy = 'CanCopy',
  IEDStructureIncompatible = 'IEDStructureIncompatible',
  ControlBlockOrDataSetAlreadyExists = 'ControlBlockOrDataSetAlreadyExists',
}

export interface ControlBlockCopyOption {
  ied: Element;
  control: Element;
  status: ControlBlockCopyStatus;
  selected: boolean;
}

export class BaseElementEditor extends ScopedElementsMixin(LitElement) {
  /** The document being edited as provided to plugins by [[`OpenSCD`]]. */
  @property({ attribute: false })
  doc!: XMLDocument;

  /** SCL change indicator */
  @property({ type: Number })
  editCount = -1;

  /** Search text for the selection list. The plugin reads this when switching screens. */
  @property({ type: String })
  searchValue = '';

  @state()
  selectCtrlBlock?: Element;

  @state()
  selectedDataSet?: Element | null;

  @state()
  controlBlockCopyOptions: ControlBlockCopyOption[] = [];

  @query('.dialog.select') selectDataSetDialog!: MdDialog;

  @query('.dialog.copy') copyControlBlockDialog!: MdDialog;

  @query('.new.dataset') newDataSet!: MdIconButton;

  @query('.change.dataset') changeDataSet!: MdIconButton;

  @query('.selectionlist')
  selectionList?: PublisherSelectionList<Element> | null;

  /** LN that owns DataSets while a new control has no parent yet. */
  protected createDataSetParent: Element | null = null;

  private pendingDataSetInsert: {
    parent: Node;
    node: Node;
    reference: Node | null;
  } | null = null;

  private pendingDataSetControl: Element | null = null;

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('doc') && changed.get('doc') != null) this.dropDocumentSelection();
  }

  /** Drops the open row when the host replaces the SCL document. */
  private dropDocumentSelection(): void {
    this.closeIfOpen(this.copyControlBlockDialog);
    this.closeIfOpen(this.selectDataSetDialog);
    this.selectionList?.classList.remove('hidden');
    this.renderRoot.querySelector('.change.scl.element')?.classList.add('hidden');
    this.selectCtrlBlock = undefined;
    this.selectedDataSet = undefined;
    this.controlBlockCopyOptions = [];
    this.createDataSetParent = null;
    this.pendingDataSetInsert = null;
    this.pendingDataSetControl = null;
    this.onDocumentReplaced();
  }

  /** Subclasses close their edit dialog and drop a pending create. */
  protected onDocumentReplaced(): void {
    return;
  }

  private closeIfOpen(dialog?: MdDialog): void {
    if (dialog?.open) dialog.close();
  }

  updated(changedProps: Map<string | number | symbol, unknown>) {
    super.updated?.(changedProps);
    if (
      changedProps.has('searchValue') &&
      this.selectionList &&
      this.selectionList.searchValue !== this.searchValue
    ) {
      this.selectionList.searchValue = this.searchValue;
    }
    this.bindSelectionSearch();
  }

  /** The selection list owns the search box. Copy typed text onto searchValue. */
  private bindSelectionSearch(): void {
    const list = this.selectionList;
    if (!list || list.hasAttribute('data-search-bound')) return;
    list.setAttribute('data-search-bound', '');
    list.addEventListener('search-change', (event: Event) => {
      const value = (event as CustomEvent<string>).detail ?? '';
      if (this.searchValue !== value) this.searchValue = value;
    });
  }

  get hasCopyControlSelected(): boolean {
    return this.controlBlockCopyOptions.some(o => o.selected);
  }

  /** Sibling DataSets of this control fill the picker. */
  protected dataSetPickerControl(): Element | undefined {
    return this.selectCtrlBlock;
  }

  /**
   * The detail renders the picker. GOOSE turns this off and renders the
   * picker itself, so Connect can open it before the detail exists.
   */
  protected dataSetPickerInDetail = true;

  protected selectDataSet(dataSet: Element): void {
    const control = this.dataSetPickerControl();
    const name = dataSet.getAttribute('name');
    if (!name || !control) return;

    this.dispatchEvent(
      newEditEvent(
        {
          element: control,
          attributes: { datSet: name },
        },
        { title: `Change Data Set of ${identity(control)}` }
      )
    );
    if (control === this.selectCtrlBlock) this.selectedDataSet = dataSet;

    this.selectDataSetDialog.close();
  }

  protected queryIEDs(): Element[] {
    return Array.from(this.doc.querySelectorAll(':root > IED'));
  }

  // eslint-disable-next-line class-methods-use-this
  protected queryLnForControl(ied: Element, control: Element): Element | null {
    const lDevice = control.closest('LDevice');
    const lnOrLn0 = control.closest('LN0, LN');

    if (!lnOrLn0 || !lDevice) {
      throw new Error('ControlBlock must be a child of LN or LN0 and LDevice');
    }

    const ldInst = lDevice.getAttribute('inst') ?? '';
    const lDeviceInIed = queryLDevice(ied, ldInst);

    if (!lDeviceInIed) {
      return null;
    }

    const lnClass = lnOrLn0.getAttribute('lnClass') ?? '';
    const inst = lnOrLn0.getAttribute('inst') ?? '';
    const prefix = lnOrLn0.getAttribute('prefix');

    return queryLN(lDeviceInIed, lnClass, inst, prefix);
  }

  // eslint-disable-next-line class-methods-use-this
  protected getDataSet(control: Element): Element | null {
    return (
      control.parentElement?.querySelector(
        `DataSet[name="${control.getAttribute('datSet')}"]`
      ) ?? null
    );
  }

  /** The data set name in a control list opens that data set. */
  protected openLinkedDataSet(event: Event, control: Element): void {
    event.stopPropagation();
    const dataSet = this.getDataSet(control);
    if (!dataSet) return;
    this.dispatchEvent(
      new CustomEvent('open-dataset', {
        detail: dataSet,
        bubbles: true,
        composed: true,
      })
    );
  }

  /** Removes only the control's datSet attribute. */
  protected disconnectDataSet(event: Event, control: Element): void {
    event.stopPropagation();
    if (!control.getAttribute('datSet')) return;
    if (dataSetLinkLocked(control)) return;
    this.dispatchEvent(
      newEditEvent(
        {
          element: control,
          attributes: { datSet: null },
        },
        { title: 'Disconnect DataSet' }
      )
    );
  }

  /** Link-off sits beside the data set name, outside the row actions. */
  protected renderDataSetDisconnect(control: Element): TemplateResult {
    if (!control.getAttribute('datSet')) return html``;
    const locked = dataSetLinkLocked(control);
    const title = locked ? subscribedDataSetTitle : 'Disconnect DataSet';
    return html`<span class="disconnect-wrap" title=${title}>
      <button
        type="button"
        class="icon-button dataset-disconnect"
        aria-label=${title}
        title=${title}
        ?disabled=${locked}
        @click=${(event: Event) => this.disconnectDataSet(event, control)}
      >
        <md-icon aria-hidden="true">link_off</md-icon>
      </button>
    </span>`;
  }

  // eslint-disable-next-line class-methods-use-this
  protected getCopyControlBlockCopyStatus(
    controlBlock: Element,
    otherIED: Element
  ): ControlBlockCopyStatus {
    const ln = this.queryLnForControl(otherIED, controlBlock);

    if (!ln) {
      return ControlBlockCopyStatus.IEDStructureIncompatible;
    }

    const controlInOtherIED = ln.querySelector(
      `${controlBlock.tagName}[name="${controlBlock.getAttribute('name')}"]`
    );
    const hasControl = Boolean(controlInOtherIED);

    const dataSet = this.getDataSet(controlBlock);

    if (!dataSet) {
      throw new Error('ControlBlock has no DataSet');
    }

    const hasDataSet =
      dataSet !== null &&
      Boolean(
        ln.querySelector(`DataSet[name="${dataSet?.getAttribute('name')}"]`)
      );

    if (hasDataSet || hasControl) {
      return ControlBlockCopyStatus.ControlBlockOrDataSetAlreadyExists;
    }

    const fcdas = Array.from(dataSet.querySelectorAll('FCDA'));
    for (const fcda of fcdas) {
      const isCompatible = isFCDACompatibleWithIED(fcda, otherIED);

      if (!isCompatible) {
        return ControlBlockCopyStatus.IEDStructureIncompatible;
      }
    }

    return ControlBlockCopyStatus.CanCopy;
  }

  protected copyControlBlock(): void {
    const selectedOptions = this.controlBlockCopyOptions.filter(
      o => o.selected
    );

    if (selectedOptions.length === 0) {
      this.copyControlBlockDialog.close();
      return;
    }

    const inserts = selectedOptions.flatMap(o => {
      const ln = this.queryLnForControl(o.ied, o.control);
      const dataSet = this.getDataSet(o.control);

      if (!ln || !dataSet) {
        throw new Error('ControlBlock or DataSet not found');
      }

      const controlCopy = o.control.cloneNode(true) as Element;
      const controlInsert = {
        parent: ln,
        node: controlCopy,
        reference: getReference(ln, controlCopy.tagName),
      };

      const dataSetCopy = dataSet.cloneNode(true) as Element;
      const dataSetInsert = {
        parent: ln,
        node: dataSetCopy,
        reference: getReference(ln, 'DataSet'),
      };

      return [dataSetInsert, controlInsert];
    });

    this.dispatchEvent(
      newEditEvent(inserts, {
        title: `Copy control block to ${selectedOptions.length} IEDs`,
      })
    );

    this.copyControlBlockDialog.close();
  }

  private addNewDataSet(control: Element): void {
    const parent = control.parentElement;
    if (!parent) return;

    const insert = createDataSet(parent);
    if (!insert) return;

    this.pendingDataSetInsert = insert;
    this.pendingDataSetControl = control;
    const path = identity(parent);
    this.dataSetHost()?.showCreateDataSet(
      insert.node as Element,
      typeof path === 'string' ? path : '',
      parent,
    );
  }

  private dataSetHost(): {
    showCreateDataSet(node: Element, path?: string, parent?: Element | null): void;
  } | null {
    const host = this.renderRoot.querySelector('data-set-element-editor');
    if (!host || !('showCreateDataSet' in host)) return null;
    return host as {
      showCreateDataSet(node: Element, path?: string, parent?: Element | null): void;
    };
  }

  private commitNewDataSet(): void {
    const insert = this.pendingDataSetInsert;
    const control = this.pendingDataSetControl;
    this.pendingDataSetInsert = null;
    this.pendingDataSetControl = null;
    if (!insert || !control) return;

    const name = (insert.node as Element).getAttribute('name');
    if (!name) return;

    this.dispatchEvent(
      newEditEvent(
        [insert, { element: control, attributes: { datSet: name } }],
        { title: 'Add New Data Set' },
      ),
    );
    this.selectedDataSet = insert.node as Element;
  }

  private cancelNewDataSet(): void {
    this.pendingDataSetInsert = null;
    this.pendingDataSetControl = null;
  }

  private showSelectDataSetDialog(): void {
    if (dataSetLinkLocked(this.selectCtrlBlock)) return;
    this.selectDataSetDialog.show();
  }

  // eslint-disable-next-line class-methods-use-this
  private getCopyStatusText(status: ControlBlockCopyStatus): string {
    switch (status) {
      case ControlBlockCopyStatus.CanCopy:
        return 'Copy possible';
      case ControlBlockCopyStatus.IEDStructureIncompatible:
        return 'IED structure incompatible';
      case ControlBlockCopyStatus.ControlBlockOrDataSetAlreadyExists:
        return 'Control block or data set already exists';
      default:
        return '';
    }
  }

  private copyMismatchTitle(option: ControlBlockCopyOption): string {
    if (option.status !== ControlBlockCopyStatus.IEDStructureIncompatible) return '';
    const host = option.control.closest('LN0, LN');
    const lDevice = option.control.closest('LDevice');
    const dataSet = this.getDataSet(option.control);
    return copyIncompatibilityTitle(
      option.ied,
      {
        ldInst: lDevice?.getAttribute('inst') ?? '',
        lnClass: host?.getAttribute('lnClass') ?? '',
        inst: host?.getAttribute('inst') ?? '',
        prefix: host?.getAttribute('prefix') ?? null,
      },
      dataSet ? Array.from(dataSet.querySelectorAll('FCDA')) : [],
    );
  }

  protected renderSelectDataSetDialog(): TemplateResult {
    const pickerParent =
      this.dataSetPickerControl()?.parentElement ?? this.createDataSetParent;
    const items = Array.from(
      pickerParent?.querySelectorAll(':scope > DataSet') ?? []
    ).map(dataSet => ({
      headline: `${dataSet.getAttribute('name')}`,
      supportingText: `${identity(dataSet)}`,
      primaryAction: () => {
        this.selectDataSet(dataSet);
      },
    }));

    return html`<md-dialog class="dialog select">
      <action-list slot="content" .items=${items} filterable></action-list>
    </md-dialog>`;
  }

  protected renderCopyControlBlockDialog(): TemplateResult {
    return html`<md-dialog
      class="dialog copy"
      @close=${() => {
        this.controlBlockCopyOptions = [];
      }}
    >
      <div slot="content" class="copy-option-list">
        ${this.controlBlockCopyOptions.map(
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
                ?disabled=${option.status !== ControlBlockCopyStatus.CanCopy}
              >
              </md-checkbox>
            </label>`
        )}
        <div class="copy-button">
          <md-outlined-button
            @click=${() => this.copyControlBlockDialog.close()}
            >Close</md-outlined-button
          >
          <md-outlined-button
            @click=${this.copyControlBlock}
            ?disabled=${!this.hasCopyControlSelected}
            >Copy</md-outlined-button
          >
        </div>
      </div>
    </md-dialog>`;
  }

  /** Pencil tooltip on the shared attribute list. */
  protected editLabel = 'Edit DataSet';

  /** Control pages pass their edit dialog into the attribute list. */
  protected renderEditDialog(): TemplateResult {
    return html``;
  }

  protected renderDataSetElementContainer(): TemplateResult {
    const changeLabel = this.selectCtrlBlock?.getAttribute('datSet')
      ? 'Change DataSet'
      : 'Connect DataSet';
    const locked = dataSetLinkLocked(this.selectCtrlBlock);
    const changeTitle = locked ? subscribedDataSetTitle : changeLabel;
    const disconnectTitle = locked
      ? subscribedDataSetTitle
      : 'Disconnect DataSet';

    return html`
      <div class="content dataSet">
        ${this.dataSetPickerInDetail ? this.renderSelectDataSetDialog() : ''}
        <data-set-element-editor
          .element=${this.selectedDataSet!}
          .showHeader=${false}
          .editLabel=${this.editLabel}
          editCount="${this.editCount}"
          @change-dataset=${() => this.showSelectDataSetDialog()}
          @dataset-create-accept=${() => this.commitNewDataSet()}
          @dataset-create-cancel=${() => this.cancelNewDataSet()}
        >
          ${this.renderEditDialog()}
          <span
            class="dataset-action ${locked ? 'locked' : ''}"
            slot="change"
            title=${changeTitle}
          >
            <md-icon-button
              class="change dataset"
              aria-label=${changeTitle}
              ?disabled=${locked}
              style=${locked ? 'pointer-events: none' : ''}
              @click=${this.showSelectDataSetDialog}
              ><md-icon>link</md-icon></md-icon-button
            >
          </span>
          ${this.selectCtrlBlock?.getAttribute('datSet')
            ? html`<span
                class="dataset-action ${locked ? 'locked' : ''}"
                slot="change"
                title=${disconnectTitle}
              >
                <md-icon-button
                  class="disconnect dataset"
                  aria-label=${disconnectTitle}
                  ?disabled=${locked}
                  style=${locked ? 'pointer-events: none' : ''}
                  @click=${(event: Event) =>
                    this.disconnectDataSet(event, this.selectCtrlBlock!)}
                  ><md-icon>link_off</md-icon></md-icon-button
                >
              </span>`
            : ''}
          <md-icon-button
            class="new dataset"
            slot="new"
            title=${'Add DataSet'}
            aria-label=${'Add DataSet'}
            ?disabled=${!!this.selectCtrlBlock!.getAttribute('datSet')}
            @click="${() => {
              this.addNewDataSet(this.selectCtrlBlock!);
            }}"
            ><md-icon>add</md-icon></md-icon-button
          ></data-set-element-editor
        >
      </div>
    `;
  }
}

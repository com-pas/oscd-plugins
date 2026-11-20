import { css, html, LitElement, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';

import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

import { MdDialog } from '@scopedelement/material-web/dialog/MdDialog.js';
import { MdIcon } from '@scopedelement/material-web/icon/MdIcon.js';
import { MdTextButton } from '@scopedelement/material-web/button/MdTextButton.js';
import { MdFilledButton } from '@scopedelement/material-web/button/MdFilledButton.js';
import { MdCheckbox } from '@scopedelement/material-web/checkbox/MdCheckbox.js';
import { TreeGrid } from '@openenergytools/tree-grid';

import { newEditEvent } from '@openenergytools/open-scd-core';
import {
  canAddFCDA,
  find,
  identity,
  maxAttributes,
  removeFCDA,
} from '@openenergytools/scl-lib';

import { pathIdentity } from '../../foundation.js';
import { DataSetEditDialog } from './data-set-edit-dialog.js';
import { addFCDAs, addFCDOs, getFcdaInstDesc } from './foundation.js';
import { dataAttributeTree } from './dataAttributePicker.js';
import { dataObjectTree } from './dataObjectPicker.js';

function dataAttributePaths(doc: XMLDocument, paths: string[][]): Element[][] {
  const daPaths: Element[][] = [];
  for (const path of paths) {
    const daPath: Element[] = [];
    for (const section of path) {
      const [tag, id] = section.split(': ');
      const ancestor = find(doc, tag, id);
      if (ancestor) daPath.push(ancestor);
    }
    daPaths.push(daPath);
  }

  return daPaths;
}

function functionalConstraintPaths(
  doc: XMLDocument,
  paths: string[][]
): { path: Element[]; fc: string }[] {
  const fcPaths: { path: Element[]; fc: string }[] = [];
  for (const path of paths) {
    const doPath: Element[] = [];
    let fc = '';
    for (const section of path) {
      const [tag, id] = section.split(': ');
      if (tag === 'FC') fc = id;
      const ancestor = find(doc, tag, id);
      if (ancestor) doPath.push(ancestor);
    }
    fcPaths.push({ path: doPath, fc });
  }

  return fcPaths;
}

interface FcdaRow {
  fcda: Element;
  signal: string;
  type: string;
  path: string;
}

function fcdaSignal(fcda: Element): string {
  const ldInst = fcda.getAttribute('ldInst') ?? '';
  const prefix = fcda.getAttribute('prefix') ?? '';
  const lnClass = fcda.getAttribute('lnClass') ?? '';
  const lnInst = fcda.getAttribute('lnInst') ?? '';
  const doName = fcda.getAttribute('doName') ?? '';
  const daName = fcda.getAttribute('daName') ?? '';
  const data = daName ? `${doName}.${daName}` : doName;
  return `${ldInst}/${prefix}${lnClass}${lnInst}.${data}`;
}

function fcdaPath(fcda: Element): string {
  return Object.values(getFcdaInstDesc(fcda))
    .flat(Infinity as 1)
    .join(' > ');
}

export class DataSetElementEditor extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'md-text-button': MdTextButton,
    'md-filled-button': MdFilledButton,
    'md-checkbox': MdCheckbox,
    'md-dialog': MdDialog,
    'md-icon': MdIcon,
    'tree-grid': TreeGrid,
    'data-set-edit-dialog': DataSetEditDialog,
  };

  /** The document being edited as provided to plugins by [[`OpenSCD`]]. */
  @property({ attribute: false })
  doc!: XMLDocument;

  /** The element being edited */
  @property({ attribute: false })
  element: Element | null = null;

  /** SCL change indicator */
  @property({ type: Number })
  editCount = -1;

  /** Pencil tooltip. GOOSE passes its own label. */
  @property({ type: String })
  editLabel = 'Edit DataSet';

  /** True once a parent assigns an edit dialog to the `edit` slot. */
  @state()
  private hasExternalEdit = false;

  @state()
  private get name(): string | null {
    return this.element?.getAttribute('name') ?? null;
  }

  @state()
  private get desc(): string | null {
    return this.element?.getAttribute('desc') ?? null;
  }

  @state()
  private get fcdaCount(): number {
    return this.element?.querySelectorAll(':scope > FCDA').length ?? 0;
  }

  @state()
  private entryFilter = '';

  @state()
  private selectedFcdas: Element[] = [];

  /** Row the dragged FCDA would be inserted before. `'end'` is the zone under the list. */
  @state()
  private dropBefore: Element | 'end' | null = null;

  private draggedFcda: Element | null = null;

  @query('data-set-edit-dialog') private editDialog!: DataSetEditDialog;

  /** Detached DataSet shown by Add until the dialog accepts it. */
  @state()
  private createNode: Element | null = null;

  private createPath = '';

  private createParent: Element | null = null;

  @query('#dapickerbutton') daPickerButton!: MdFilledButton;

  @query('#dapicker') daPickerDialog!: MdDialog;

  @query('#dapicker > tree-grid') daPicker!: TreeGrid;

  @query('.da.picker.save') daPickerSaveButton!: MdTextButton;

  @query('#dopickerbutton') doPickerButton!: MdFilledButton;

  @query('#dopicker') doPickerDialog!: MdDialog;

  @query('#dopicker > tree-grid') doPicker!: TreeGrid;

  @query('.do.picker.save') doPickerSaveButton!: MdTextButton;

  public resetInputs(): void {
    this.element = null; // removes inputs and forces a re-render

    this.selectedFcdas = [];
    this.entryFilter = '';
  }

  /** Closes the name dialog and the FCDA pickers before the detail is removed. */
  public closeOpenDialogs(): void {
    this.editDialog?.close();
    this.closeNativeDialog(this.doPickerDialog);
    this.closeNativeDialog(this.daPickerDialog);
  }

  private closeNativeDialog(dialog?: MdDialog): void {
    if (dialog?.open) dialog.close();
  }

  override willUpdate(changed: PropertyValues): void {
    if (!changed.has('element')) return;
    // A new array in updated() would schedule a second update.
    this.selectedFcdas = [];
    this.entryFilter = '';
    this.draggedFcda = null;
    this.dropBefore = null;
  }

  override updated(changed: PropertyValues): void {
    if (!changed.has('element')) this.pruneSelection();
    this.syncExternalEdit();
  }

  private onEditSlotChange(event: Event): void {
    const slot = event.target as HTMLSlotElement;
    this.hasExternalEdit = slot.assignedElements().length > 0;
  }

  /** Slot assignment can happen before the listener is attached. */
  private syncExternalEdit(): void {
    const slot = this.renderRoot.querySelector(
      'slot[name="edit"]'
    ) as HTMLSlotElement | null;
    const assigned = (slot?.assignedElements().length ?? 0) > 0;
    if (assigned !== this.hasExternalEdit) this.hasExternalEdit = assigned;
  }

  private externalEdit(): { show: () => void } | null {
    const node = Array.from(this.children).find(
      child => child.getAttribute('slot') === 'edit'
    );
    const show = (node as { show?: unknown } | undefined)?.show;
    if (typeof show !== 'function') return null;
    return { show: () => show.call(node) };
  }

  /** Opens the name dialog for a DataSet that is not in the document yet. */
  public showCreateDataSet(
    node: Element,
    path = '',
    parent: Element | null = null,
  ): void {
    this.createNode = node;
    this.createPath = path;
    this.createParent = parent;
    void this.updateComplete.then(() => this.editDialog?.show());
  }

  private finishCreate(): void {
    const node = this.createNode;
    this.createNode = null;
    this.createPath = '';
    this.createParent = null;
    this.dispatchEvent(
      new CustomEvent('dataset-create-accept', {
        detail: { node },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private cancelCreate(): void {
    this.createNode = null;
    this.createPath = '';
    this.createParent = null;
    this.dispatchEvent(
      new CustomEvent('dataset-create-cancel', { bubbles: true, composed: true }),
    );
  }

  private openEditDialog(): void {
    const external = this.externalEdit();
    if (external) {
      external.show();
      return;
    }
    this.editDialog?.show();
  }

  private renderEditButton(): TemplateResult {
    return html`<button
      type="button"
      class="icon-button"
      aria-label=${this.editLabel}
      title=${this.editLabel}
      @click=${() => this.openEditDialog()}
    >
      <md-icon>edit</md-icon>
    </button>`;
  }

  private saveDataObjects(): void {
    const { paths } = this.doPicker;

    const actions = addFCDOs(
      this.element!,
      functionalConstraintPaths(this.element!.ownerDocument, paths)
    );

    this.dispatchEvent(
      newEditEvent(actions, {
        title: `Add Data Object to DataSet ${identity(this.element)}`,
      })
    );
    this.doPickerDialog.close();
  }

  private saveDataAttributes(): void {
    const { paths } = this.daPicker;

    const actions = addFCDAs(
      this.element!,
      dataAttributePaths(this.element!.ownerDocument, paths)
    );

    this.dispatchEvent(
      newEditEvent(actions, {
        title: `Add Data Attributes to DataSet ${identity(this.element)}`,
      })
    );
    this.daPickerDialog.close();
  }

  private fcdaRows(): FcdaRow[] {
    return Array.from(this.element?.querySelectorAll(':scope > FCDA') ?? []).map(
      fcda => ({
        fcda,
        signal: fcdaSignal(fcda),
        type: fcda.getAttribute('fc') ?? '',
        path: fcdaPath(fcda),
      })
    );
  }

  private visibleRows(): FcdaRow[] {
    const query = this.entryFilter.trim().toLowerCase();
    const rows = this.fcdaRows();
    if (!query) return rows;
    return rows.filter(
      row =>
        row.signal.toLowerCase().includes(query) ||
        row.type.toLowerCase().includes(query) ||
        row.path.toLowerCase().includes(query)
    );
  }

  private visibleSelected(): Element[] {
    const visible = new Set(this.visibleRows().map(row => row.fcda));
    return this.selectedFcdas.filter(fcda => visible.has(fcda));
  }

  private pruneSelection(): void {
    const live = new Set<Element>(
      this.element
        ? Array.from(this.element.querySelectorAll(':scope > FCDA'))
        : []
    );
    const next = this.selectedFcdas.filter(fcda => live.has(fcda));
    if (next.length !== this.selectedFcdas.length) this.selectedFcdas = next;
  }

  private setRowSelected(fcda: Element, checked: boolean): void {
    const selected = new Set(this.selectedFcdas);
    if (checked) selected.add(fcda);
    else selected.delete(fcda);
    this.selectedFcdas = [...selected];
  }

  private toggleVisibleSelection(): void {
    const visible = this.visibleRows().map(row => row.fcda);
    const selected = new Set(this.selectedFcdas);
    const allVisible =
      visible.length > 0 && visible.every(fcda => selected.has(fcda));
    for (const fcda of visible) {
      if (allVisible) selected.delete(fcda);
      else selected.add(fcda);
    }
    this.selectedFcdas = [...selected];
  }

  private removeFcdas(fcdas: Element[]): void {
    if (!this.element || fcdas.length === 0) return;

    const removed = new Set(fcdas);
    this.selectedFcdas = this.selectedFcdas.filter(fcda => !removed.has(fcda));
    const actions = fcdas.map(node => removeFCDA({ node }));
    this.dispatchEvent(
      newEditEvent(actions.length === 1 ? actions[0] : actions, {
        title: 'Remove FCDA',
      })
    );
  }

  private commitMove(fcda: Element, reference: Element | null): void {
    if (fcda === reference || fcda.nextElementSibling === reference) return;
    const parent = fcda.parentElement;
    if (!parent) return;

    this.dispatchEvent(
      newEditEvent(
        [
          { node: fcda },
          { parent, node: fcda, reference },
        ],
        { title: 'Change FCDA order' }
      )
    );
  }

  /**
   * Sibling after the last visible FCDA.
   * `undefined` when the filter shows nothing. `null` when that row is last in the DataSet.
   */
  private referenceAfterLastVisible(): Element | null | undefined {
    const last = this.visibleRows().at(-1)?.fcda;
    if (!last) return undefined;
    return last.nextElementSibling;
  }

  private onDragStart(event: DragEvent, fcda: Element): void {
    this.draggedFcda = fcda;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', 'fcda');
    }
  }

  private onDragOverRow(event: DragEvent, fcda: Element): void {
    if (!this.draggedFcda || this.draggedFcda === fcda) return;
    event.preventDefault();
    this.dropBefore = fcda;
  }

  private onDropOnRow(event: DragEvent, fcda: Element): void {
    event.preventDefault();
    const dragged = this.draggedFcda;
    this.draggedFcda = null;
    this.dropBefore = null;
    if (!dragged) return;
    this.commitMove(dragged, fcda);
  }

  private onDragOverEnd(event: DragEvent): void {
    if (!this.draggedFcda) return;
    event.preventDefault();
    this.dropBefore = 'end';
  }

  private onDropAtEnd(event: DragEvent): void {
    event.preventDefault();
    const dragged = this.draggedFcda;
    const reference = this.referenceAfterLastVisible();
    this.draggedFcda = null;
    this.dropBefore = null;
    if (!dragged || reference === undefined) return;
    this.commitMove(dragged, reference);
  }

  private onDragEnd(): void {
    this.draggedFcda = null;
    this.dropBefore = null;
  }

  private renderHeader(): TemplateResult {
    if (!this.element) {
      return html`<div class="detail-top">
        <div class="detail-heading">
          <div class="detail-title">
            <span class="headersubtitle">No DataSet connected</span>
            ${this.hasExternalEdit ? this.renderEditButton() : ''}
            <slot name="change"></slot>
            <slot name="new"></slot>
          </div>
        </div>
      </div>`;
    }

    const path = pathIdentity(this.element);
    const showPath = path !== '' && path !== 'UNDEFINED';

    return html`<div class="detail-top">
      <div class="detail-heading">
        <div class="detail-title">
          ${showPath
            ? html`<span class="detail-path">${path}</span
                ><span class="detail-sep"> &gt; </span>`
            : ''}
          <span class="detail-name">${this.name ?? ''}</span>
          ${this.renderEditButton()}
          <slot name="change"></slot>
          <slot name="new"></slot>
        </div>
        <div class="detail-desc">${this.desc ?? ''}</div>
      </div>
      <div class="detail-actions">
        <div class="entry-search">
          <md-icon class="search-icon" aria-hidden="true">search</md-icon>
          <input
            type="search"
            placeholder="Search entries"
            .value=${this.entryFilter}
            @input=${(event: Event) => {
              this.entryFilter = (event.target as HTMLInputElement).value;
            }}
          />
        </div>
        ${this.renderLimits()} ${this.renderDataPickers()}
      </div>
    </div>`;
  }

  private renderLimits(): TemplateResult {
    if (!this.element) return html``;

    const { max } = maxAttributes(this.element);
    return html`<span class="entry-count"
      >${this.fcdaCount} / ${max} Entries</span
    >`;
  }

  private renderDataObjectPicker(): TemplateResult {
    const server = this.element!.closest('Server')!;

    return html`<md-filled-button
        id="dopickerbutton"
        ?disabled=${!canAddFCDA(this.element!)}
        @click=${() => this.doPickerDialog?.show()}
        >Add data object<md-icon slot="icon">add</md-icon></md-filled-button
      ><md-dialog id="dopicker">
        <div slot="headline">Add Data Objects</div>
        <tree-grid slot="content" .tree=${dataObjectTree(server)}></tree-grid>
        <div slot="actions">
          <md-text-button @click=${() => this.doPickerDialog?.close()}
            >Close</md-text-button
          >
          <md-text-button class="do picker save" @click=${this.saveDataObjects}
            >Save<md-icon slot="icon">save</md-icon></md-text-button
          >
        </div>
      </md-dialog>`;
  }

  private renderDataAttributePicker(): TemplateResult {
    const server = this.element!.closest('Server')!;

    return html`<md-filled-button
        id="dapickerbutton"
        ?disabled=${!canAddFCDA(this.element!)}
        @click=${() => this.daPickerDialog.show()}
        >Add data attribute<md-icon slot="icon">add</md-icon></md-filled-button
      ><md-dialog id="dapicker">
        <div slot="headline">Add Data Attributes</div>
        <tree-grid
          slot="content"
          .tree="${dataAttributeTree(server)}"
        ></tree-grid>
        <div slot="actions">
          <md-text-button @click=${() => this.daPickerDialog?.close()}
            >Close</md-text-button
          >
          <md-text-button
            class="da picker save"
            @click=${this.saveDataAttributes}
          >
            Save
            <md-icon slot="icon">Save</md-icon>
          </md-text-button>
        </div>
      </md-dialog>`;
  }

  private renderDataPickers(): TemplateResult {
    return html`<div class="add-buttons">
      ${this.renderDataAttributePicker()} ${this.renderDataObjectPicker()}
    </div>`;
  }

  private renderFCDAList(): TemplateResult {
    const rows = this.visibleRows();
    const selected = new Set(this.selectedFcdas);
    const visibleSelected = rows.filter(row => selected.has(row.fcda)).length;
    const allVisible = rows.length > 0 && visibleSelected === rows.length;
    const someVisible = visibleSelected > 0 && !allVisible;

    return html`<div class="entry-scroll">
      <div class="entry-head">
        <span></span>
        <md-checkbox
          aria-label="Select visible entries"
          .checked=${allVisible}
          .indeterminate=${someVisible}
          ?disabled=${rows.length === 0}
          @change=${() => this.toggleVisibleSelection()}
        ></md-checkbox>
        <span>Signal</span>
        <span>Type</span>
        <span>Path</span>
        <span class="entry-head-delete">
          ${visibleSelected > 0
            ? html`<button
                  type="button"
                  class="delete-selected"
                  @click=${() => this.removeFcdas(this.visibleSelected())}
                >
                  Delete selected (${visibleSelected})
                </button>
                <button
                  type="button"
                  class="icon-button"
                  aria-label="Delete selected entries"
                  title="Delete selected entries"
                  @click=${() => this.removeFcdas(this.visibleSelected())}
                >
                  <md-icon>delete</md-icon>
                </button>`
            : ''}
        </span>
      </div>
      ${rows.map(
        row => html`<div
          class=${this.dropBefore === row.fcda ? 'entry-row drop-before' : 'entry-row'}
          @dragover=${(event: DragEvent) => this.onDragOverRow(event, row.fcda)}
          @drop=${(event: DragEvent) => this.onDropOnRow(event, row.fcda)}
        >
          <span
            class="drag-handle"
            draggable="true"
            aria-label="Reorder entry"
            @dragstart=${(event: DragEvent) => this.onDragStart(event, row.fcda)}
            @dragend=${() => this.onDragEnd()}
          >
            <md-icon>drag_indicator</md-icon>
          </span>
          <md-checkbox
            aria-label="Select entry"
            .checked=${selected.has(row.fcda)}
            @change=${(event: Event) => {
              this.setRowSelected(
                row.fcda,
                (event.target as MdCheckbox).checked
              );
            }}
          ></md-checkbox>
          <span class="entry-signal">${row.signal}</span>
          <span class="entry-type">${row.type}</span>
          <span class="entry-path">${row.path}</span>
          <button
            type="button"
            class="icon-button entry-delete"
            aria-label="Remove FCDA"
            title="Remove FCDA"
            @click=${() => this.removeFcdas([row.fcda])}
          >
            <md-icon>delete</md-icon>
          </button>
        </div>`
      )}
      <div
        class=${this.dropBefore === 'end' ? 'entry-drop-end drop-end' : 'entry-drop-end'}
        @dragover=${(event: DragEvent) => this.onDragOverEnd(event)}
        @drop=${(event: DragEvent) => this.onDropAtEnd(event)}
      ></div>
    </div>`;
  }

  render(): TemplateResult {
    const body = this.element
      ? html`${this.renderHeader()} ${this.renderFCDAList()}`
      : this.renderHeader();

    return html`<div class="content">
      ${body}
      <slot
        name="edit"
        @slotchange=${(event: Event) => this.onEditSlotChange(event)}
      ></slot>
      ${this.hasExternalEdit
        ? ''
        : html`<data-set-edit-dialog
            .element=${this.createNode ?? this.element}
            .creating=${this.createNode !== null}
            .createPath=${this.createPath}
            .nameParent=${this.createNode ? this.createParent : null}
            @create-accept=${() => this.finishCreate()}
            @create-cancel=${() => this.cancelCreate()}
          ></data-set-edit-dialog>`}
    </div>`;
  }

  static styles = css`
    :host {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      width: 100%;
      color: var(--oscd-plugin-internal-base03);
      font-family: var(--oscd-plugin-internal-text-font);
    }

    .content {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      min-width: 0;
      background-color: var(--oscd-plugin-internal-base3);
    }

    .detail-top {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 12px 16px;
      min-width: 0;
      padding: 12px 12px 8px;
    }

    .detail-heading {
      flex: 1 1 240px;
      min-width: 0;
    }

    .detail-title {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
    }

    .detail-path,
    .detail-sep,
    .detail-desc,
    .entry-count,
    .entry-head {
      color: var(--oscd-plugin-internal-base01);
    }

    .detail-path,
    .detail-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .detail-name {
      font-weight: 500;
    }

    .detail-desc {
      min-height: 1.2em;
      font-size: 14px;
    }

    .detail-actions {
      display: flex;
      flex: 1 1 360px;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .entry-search {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 140px;
      height: 36px;
      padding: 0 12px;
      border: 1px solid var(--oscd-plugin-internal-base1);
      border-radius: var(--oscd-plugin-internal-shape-extra-small);
      background: var(--oscd-plugin-internal-base3);
    }

    .entry-search:focus-within {
      outline: 1px solid var(--oscd-plugin-internal-primary);
    }

    .entry-search .search-icon {
      flex: none;
      color: var(--oscd-plugin-internal-base01);
      font-size: 20px;
    }

    .entry-search input {
      flex: 1;
      min-width: 0;
      height: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--oscd-plugin-internal-base03);
      font-family: var(--oscd-plugin-internal-text-font);
      font-size: 14px;
    }

    .entry-search input:focus {
      outline: none;
    }

    .entry-count {
      white-space: nowrap;
      font-size: 14px;
    }

    .add-buttons {
      display: flex;
      flex-shrink: 0;
      gap: 8px;
    }

    .entry-scroll {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      overflow: auto;
    }

    .entry-head,
    .entry-row {
      display: grid;
      grid-template-columns: 28px 40px minmax(140px, 1.5fr) 64px minmax(120px, 2fr) 40px;
      align-items: center;
      column-gap: 8px;
      min-width: 640px;
      padding: 0 8px;
    }

    .entry-head {
      position: sticky;
      top: 0;
      /* Above the rows. The edit dialog uses showModal, so it stays on top. */
      z-index: 1;
      min-height: 36px;
      background: var(--oscd-plugin-internal-base3);
      border-bottom: 1px solid var(--oscd-plugin-internal-base2);
      font-size: 13px;
      font-weight: 500;
    }

    .entry-head-delete {
      position: absolute;
      right: 8px;
      display: flex;
      align-items: center;
      gap: 4px;
      height: 36px;
    }

    .entry-delete {
      justify-self: end;
    }

    .entry-row {
      /* Flex item. z-index traps md-checkbox under the sticky head. */
      z-index: 0;
      min-height: 32px;
      font-size: 14px;
      border-bottom: 1px solid var(--oscd-plugin-internal-base2);
    }

    .entry-row md-icon {
      color: var(--oscd-plugin-internal-base03);
      font-size: 20px;
    }

    .entry-row.drop-before,
    .entry-drop-end.drop-end {
      box-shadow: inset 0 2px 0 var(--oscd-plugin-internal-primary);
    }

    .entry-signal,
    .entry-type,
    .entry-path {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .entry-signal {
      font-weight: 500;
    }

    .entry-drop-end {
      flex: 1;
      min-height: 48px;
    }

    .drag-handle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      color: var(--oscd-plugin-internal-base01);
    }

    .icon-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: var(--oscd-plugin-internal-shape-extra-small);
      background: transparent;
      color: var(--oscd-plugin-internal-base03);
      cursor: pointer;
    }

    .icon-button:hover {
      background: var(--oscd-plugin-internal-base2);
    }

    .entry-delete:hover,
    .entry-head-delete .icon-button:hover {
      color: var(--oscd-plugin-internal-error);
    }

    .delete-selected {
      border: 0;
      background: transparent;
      color: var(--oscd-plugin-internal-base01);
      cursor: pointer;
      font-family: var(--oscd-plugin-internal-text-font);
      font-size: 13px;
      white-space: nowrap;
    }

    #dapicker,
    #dopicker {
      min-width: 80%;
      min-height: 80%;
    }

    h2 {
      margin: 0;
      padding: 12px;
      color: var(--oscd-plugin-internal-base03);
      font-weight: 300;
    }

    .headersubtitle {
      font-size: 16px;
      font-weight: 200;
    }

    ::slotted(md-icon-button[disabled]) {
      display: none;
    }

    ::slotted(.dataset-action) {
      display: inline-flex;
      align-items: center;
    }

    ::slotted(.dataset-action.locked) {
      cursor: not-allowed;
    }

    @media (max-width: 720px) {
      .add-buttons {
        width: 100%;
      }
    }
  `;
}

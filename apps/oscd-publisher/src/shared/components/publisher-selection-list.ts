import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';

import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { MdFilledButton } from '@scopedelement/material-web/button/MdFilledButton.js';
import { MdIcon } from '@scopedelement/material-web/icon/MdIcon.js';

/** Group plus. `block` is the tooltip while adding is impossible. */
export function renderIedAddButton(
  label: string,
  block: string | null,
  onClick: () => void,
): TemplateResult {
  const tip = block ?? label;
  return html`<span class="ied-add-wrap" title=${tip}>
    <button
      type="button"
      class="icon-button ied-add"
      aria-label=${tip}
      title=${tip}
      ?disabled=${block !== null}
      @click=${onClick}
    >
      <md-icon aria-hidden="true">add</md-icon>
    </button>
  </span>`;
}

/** One collapsible group in the publisher selection list. */
export interface SelectionListGroup<T> {
  id: string;
  label: string;
  /** Unfiltered row count, shown on the group header. */
  count: number;
  /** Replaces {@link count} on the badge. An empty string hides it. */
  countLabel?: string;
  /** Native tooltip on the badge. */
  countTitle?: string;
  /** Plain text to the right of the badge. */
  countNote?: string;
  rows: T[];
}

/** Above this many rows, IED groups start closed. */
const collapseRowLimit = 100;

/** Wait until typing pauses before filtering the list. */
const searchDebounceMs = 200;

/**
 * IED-style selection list for the publisher screens.
 * Search filters through `visibleRows`. Open and closed groups stay in
 * `collapsedIds`, including while a search is active. Groups start open.
 * Past {@link collapseRowLimit} rows they start closed, except `initialOpenId`.
 * A search shows the matching rows and leaves `collapsedIds` unchanged.
 * The field updates immediately. The filter waits {@link searchDebounceMs}.
 */
export class PublisherSelectionList<T = unknown> extends ScopedElementsMixin(
  LitElement
) {
  static scopedElements = {
    'md-filled-button': MdFilledButton,
    'md-icon': MdIcon,
  };

  @property({ type: Array })
  groups: SelectionListGroup<T>[] = [];

  @property({ type: String })
  searchValue = '';

  @property({ type: String })
  searchPlaceholder = 'Search...';

  @property({ type: String })
  groupIcon = 'developer_board';

  /** Return the rows to render, or null to hide the whole group. */
  @property({ attribute: false })
  visibleRows: (
    group: SelectionListGroup<T>,
    query: string
  ) => T[] | null = group => group.rows;

  @property({ attribute: false })
  renderRow: (
    group: SelectionListGroup<T>,
    row: T
  ) => TemplateResult = () => html``;

  @property({ attribute: false })
  renderGroupAction: (
    group: SelectionListGroup<T>
  ) => TemplateResult = () => html``;

  /** Column titles. Rendered only when the editor sets this. */
  @property({ attribute: false })
  renderHeader?: () => TemplateResult;

  /** Lays the header and each row out on `--selection-columns`. */
  @property({ type: Boolean, reflect: true })
  columns = false;

  /** Group left open when a large list starts collapsed. */
  @property({ type: String })
  initialOpenId = '';

  /** Group ids the user collapsed. Missing ids stay open. */
  @state()
  private collapsedIds: string[] = [];

  private rowCollapseApplied = false;

  /** Text in the field. Kept off the filter until typing pauses. */
  private queryText = '';

  /** Query the rows are filtered with. */
  private appliedQuery = '';

  /** Browser timer id. DOM `setTimeout` returns a number, not Node's `Timeout`. */
  private searchTimer: number | undefined;

  override disconnectedCallback(): void {
    this.clearSearchTimer();
    super.disconnectedCallback();
  }

  override willUpdate(changed: PropertyValues): void {
    if (changed.has('searchValue') && this.searchValue !== this.queryText) {
      this.clearSearchTimer();
      this.queryText = this.searchValue;
      this.appliedQuery = this.searchValue;
    }
    if (this.rowCollapseApplied) return;
    this.rowCollapseApplied = true;
    const total = this.groups.reduce((sum, group) => sum + group.rows.length, 0);
    if (total <= collapseRowLimit) return;
    this.collapsedIds = this.groups
      .map(group => group.id)
      .filter(id => id.length > 0 && id !== this.initialOpenId);
  }

  private isOpen(id: string): boolean {
    return !this.collapsedIds.includes(id);
  }

  private hasQuery(): boolean {
    return this.appliedQuery.trim().length > 0;
  }

  /** Rows are visible while the group is open, or while a search has hits. */
  private rowsOpen(id: string, rowCount: number): boolean {
    return this.isOpen(id) || (this.hasQuery() && rowCount > 0);
  }

  private toggle(id: string): void {
    if (this.isOpen(id)) {
      this.collapsedIds = [...this.collapsedIds, id];
      return;
    }
    // A search is showing this closed group. Do not store it as open.
    if (this.hasQuery()) return;
    this.collapsedIds = this.collapsedIds.filter(entry => entry !== id);
  }

  /** Opens one group so a row added there is visible. */
  openGroup(id: string): void {
    if (this.isOpen(id)) return;
    this.collapsedIds = this.collapsedIds.filter(entry => entry !== id);
  }

  private expandAll(): void {
    this.collapsedIds = [];
  }

  private collapseAll(): void {
    this.collapsedIds = this.groups
      .map(group => group.id)
      .filter(id => id.length > 0);
  }

  private clearSearchTimer(): void {
    if (this.searchTimer === undefined) return;
    window.clearTimeout(this.searchTimer);
    this.searchTimer = undefined;
  }

  private onSearchInput(event: Event): void {
    this.queryText = (event.target as HTMLInputElement).value;
    this.clearSearchTimer();
    this.searchTimer = window.setTimeout(() => {
      this.searchTimer = undefined;
      this.commitQuery(this.queryText);
    }, searchDebounceMs);
  }

  /** Publishes the paused text as the filter and to the editor. */
  private commitQuery(value: string): void {
    const filterChanged = this.appliedQuery !== value;
    if (!filterChanged && this.searchValue === value) return;
    this.appliedQuery = value;
    if (this.searchValue !== value) this.searchValue = value;
    else this.requestUpdate();
    this.dispatchEvent(
      new CustomEvent('search-change', {
        detail: value,
        bubbles: true,
        composed: true,
      })
    );
  }

  private shownRows(group: SelectionListGroup<T>): T[] | null {
    return this.visibleRows(group, this.appliedQuery.trim().toLowerCase());
  }

  /** Column titles only while a group is showing rows. */
  private hasOpenGroup(): boolean {
    return this.groups.some(group => {
      const rows = this.shownRows(group);
      return !!rows?.length && this.rowsOpen(group.id, rows.length);
    });
  }

  private renderCount(group: SelectionListGroup<T>): TemplateResult | typeof nothing {
    const label = group.countLabel ?? (group.count ? String(group.count) : '');
    if (!label) return nothing;
    return html`<span class="ied-count" title=${group.countTitle ?? nothing}>${label}</span>`;
  }

  private renderGroup(group: SelectionListGroup<T>): TemplateResult {
    const rows = this.shownRows(group);
    if (!rows) return html``;

    const open = this.rowsOpen(group.id, rows.length);
    const chevronLabel = open ? 'Collapse' : 'Expand';
    return html`<section class="ied-group">
      <div class="ied-row">
        <button
          type="button"
          class="ied-toggle"
          aria-expanded=${open}
          @click=${() => this.toggle(group.id)}
        >
          <md-icon class="ied-icon" aria-hidden="true">${this.groupIcon}</md-icon>
          <span class="ied-name">${group.label}</span>
          ${this.renderCount(group)}
          ${group.countNote
            ? html`<span class="ied-note">${group.countNote}</span>`
            : nothing}
        </button>
        ${this.renderGroupAction(group)}
        <button
          type="button"
          class="icon-button ied-chevron"
          aria-label=${chevronLabel}
          title=${chevronLabel}
          @click=${() => this.toggle(group.id)}
        >
          <md-icon class="chevron" aria-hidden="true"
            >${open ? 'expand_less' : 'expand_more'}</md-icon
          >
        </button>
      </div>
      ${open
        ? html`<div class="dataset-rows">
            ${rows.map(row => this.renderRow(group, row))}
          </div>`
        : html``}
    </section>`;
  }

  render(): TemplateResult {
    return html`<div class="list-frame">
      <div class="dataset-toolbar">
        <div class="search-field">
          <md-icon class="search-icon" aria-hidden="true">search</md-icon>
          <input
            class="dataset-search"
            type="search"
            placeholder=${this.searchPlaceholder}
            .value=${this.queryText}
            @input=${(event: Event) => this.onSearchInput(event)}
          />
        </div>
        <button
          type="button"
          class="icon-button"
          aria-label="Expand all"
          title="Expand all"
          @click=${() => this.expandAll()}
        >
          <md-icon aria-hidden="true">unfold_more</md-icon>
        </button>
        <button
          type="button"
          class="icon-button"
          aria-label="Collapse all"
          title="Collapse all"
          @click=${() => this.collapseAll()}
        >
          <md-icon aria-hidden="true">unfold_less</md-icon>
        </button>
      </div>
      <div class="list-scroll">
        ${this.renderHeader && this.hasOpenGroup()
          ? html`<div class="selection-header">${this.renderHeader()}</div>`
          : ''}
        <div class="ied-groups">
          ${this.groups.map(group => this.renderGroup(group))}
        </div>
      </div>
    </div>`;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      box-sizing: border-box;
    }

    .list-frame {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      container-name: publisher-list;
      container-type: inline-size;
    }

    .dataset-toolbar {
      flex: none;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px;
      background: color-mix(
        in srgb,
        var(--oscd-plugin-internal-base2) 40%,
        var(--oscd-plugin-internal-base3)
      );
    }

    .search-field {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      height: 36px;
      padding: 0 12px;
      border: 1px solid var(--oscd-plugin-internal-base1);
      border-radius: var(--oscd-plugin-internal-shape-extra-small);
      background: var(--oscd-plugin-internal-base3);
    }

    .search-field:focus-within {
      outline: 1px solid var(--oscd-plugin-internal-primary);
    }

    .dataset-search {
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

    .dataset-search:focus {
      outline: none;
    }

    md-icon {
      color: var(--oscd-plugin-internal-base03);
      font-size: 20px;
    }

    .ied-add md-icon {
      font-size: 17px;
    }

    .dataset-row .icon-button md-icon {
      color: var(--oscd-plugin-internal-primary);
    }

    .dataset-toolbar md-icon {
      font-size: 24px;
    }

    .search-field .search-icon {
      flex: none;
      color: var(--oscd-plugin-internal-base01);
      font-size: 20px;
    }

    .list-scroll {
      /* Keeps the sticky header's z-index under the dialog scrim. */
      position: relative;
      z-index: 0;
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
      overflow: auto;
    }

    .ied-groups {
      min-height: 0;
    }

    .ied-row {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 28px;
      padding: 0 8px 0 4px;
      border-bottom: 1px solid var(--oscd-plugin-internal-base2);
      background: color-mix(
        in srgb,
        var(--oscd-plugin-internal-base2) 40%,
        var(--oscd-plugin-internal-base3)
      );
    }

    .ied-toggle {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      margin: 0;
      padding: 2px 8px;
      border: 0;
      background: transparent;
      color: var(--oscd-plugin-internal-base03);
      font-family: var(--oscd-plugin-internal-text-font);
      font-size: 14px;
      text-align: left;
      cursor: pointer;
    }

    .ied-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 500;
    }

    .ied-toggle:has(.ied-note) .ied-name {
      flex: none;
    }

    .ied-note {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      color: var(--oscd-plugin-internal-base00);
      font-weight: 400;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ied-count {
      flex: none;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      white-space: nowrap;
      border-radius: 999px;
      background: color-mix(
        in srgb,
        var(--oscd-plugin-internal-primary) 18%,
        var(--oscd-plugin-internal-base3)
      );
      color: var(--oscd-plugin-internal-primary);
      font-size: 14px;
      line-height: 18px;
      text-align: center;
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

    .ied-add-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .ied-add-wrap:has(.ied-add:disabled) {
      cursor: not-allowed;
    }

    .ied-add {
      width: 17px;
      height: 17px;
      border-radius: 50%;
      background: var(--oscd-plugin-internal-base03);
    }

    .ied-add:disabled {
      background: var(--oscd-plugin-internal-base1);
      opacity: 1;
      pointer-events: none;
    }

    .ied-chevron {
      width: 17px;
      height: 17px;
    }

    .ied-add md-icon {
      color: var(--oscd-plugin-internal-base3);
    }

    .ied-add.icon-button:hover {
      background: var(--oscd-plugin-internal-base01);
    }

    .ied-add.icon-button:disabled:hover {
      background: var(--oscd-plugin-internal-base1);
    }

    .dataset-delete:hover {
      color: var(--oscd-plugin-internal-error);
    }

    .dataset-row {
      display: flex;
      align-items: center;
      gap: 8px;
      box-sizing: border-box;
      min-height: 32px;
      padding: 0px 4px 0px 36px;
      border-bottom: 1px solid var(--oscd-plugin-internal-base2);
      cursor: pointer;
      font-size: 14px;
    }

    .dataset-row .icon-button {
      width: 25px;
      height: 25px;
    }

    .dataset-row.selected {
      background: color-mix(
        in srgb,
        var(--oscd-plugin-internal-primary) 16%,
        var(--oscd-plugin-internal-base3)
      );
    }

    .dataset-label {
      display: flex;
      flex: 1;
      align-items: baseline;
      gap: 8px;
      min-width: 0;
    }

    .dataset-name {
      color: var(--oscd-plugin-internal-base03);
      font-family: var(--oscd-plugin-internal-text-font);
      font-size: 14px;
      white-space: nowrap;
      font-weight: 500;
    }

    .dataset-path {
      color: var(--oscd-plugin-internal-base00);
      font-family: var(--oscd-plugin-internal-text-font);
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 500;
    }

    .dataset-chips {
      display: flex;
      flex-shrink: 0;
      justify-content: flex-end;
      gap: 4px;
    }

    .chip {
      padding: 1px 6px;
      border-radius: 999px;
      background: var(--oscd-plugin-internal-base2);
      color: var(--oscd-plugin-internal-base01);
      font-family: var(--oscd-plugin-internal-text-font);
      font-size: 12px;
      white-space: nowrap;
    }

    .chip-none {
      background: color-mix(
        in srgb,
        var(--oscd-plugin-internal-violet) 16%,
        var(--oscd-plugin-internal-base3)
      );
      color: var(--oscd-plugin-internal-violet);
    }

    .dataset-actions {
      display: flex;
      flex-shrink: 0;
    }

    .selection-header {
      position: sticky;
      top: 0;
      z-index: 2;
      box-sizing: border-box;
      align-items: center;
      border-bottom: 1px solid var(--oscd-plugin-internal-base2);
      background: color-mix(
        in srgb,
        var(--oscd-plugin-internal-base2) 40%,
        var(--oscd-plugin-internal-base3)
      );
      color: var(--oscd-plugin-internal-base01);
      font-family: var(--oscd-plugin-internal-text-font);
      font-size: 14px;
      font-weight: 500;
    }

    /* A percentage width is cyclic with the fr tracks, so the box stays
       at the scrollport while the tracks overflow. min-content is the
       track minimums plus the column gap and the row padding. */
    :host([columns]) .selection-header,
    :host([columns]) .ied-groups,
    :host([columns]) .dataset-row {
      min-width: min-content;
    }

    :host([columns]) .selection-header,
    :host([columns]) .dataset-row {
      display: grid;
      grid-template-columns: var(--selection-columns);
      align-items: center;
      gap: 0 8px;
      padding: 0px 8px 0px 36px;
    }

    :host([columns]) .selection-header {
      min-height: 32px;
    }

    :host([columns]) .cell {
      min-width: 0;
    }

    :host([columns]) .clip {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :host([columns]) .dataset-actions,
    :host([columns]) .selection-header .actions {
      position: sticky;
      right: 0;
      z-index: 1;
      justify-self: end;
      background: var(--oscd-plugin-internal-base3);
    }

    :host([columns]) .dataset-row.selected .dataset-actions,
    :host([columns]) .selection-header .actions {
      background: inherit;
    }

    .cell .dataset-connected {
      display: block;
      overflow: hidden;
      color: var(--oscd-plugin-internal-primary);
      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cell button.dataset-connected {
      width: auto;
      max-width: 100%;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    :host([columns]) .dataset-cell {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
    }

    .dataset-cell .dataset-connected {
      flex: 0 1 auto;
      min-width: 0;
    }

    .disconnect-wrap {
      display: inline-flex;
      flex: none;
    }

    .disconnect-wrap:has(button:disabled) {
      cursor: not-allowed;
    }

    .dataset-disconnect:disabled {
      pointer-events: none;
    }

    .dataset-row .dataset-disconnect:disabled md-icon {
      color: var(--oscd-plugin-internal-base1);
    }

    @container publisher-list (max-width: 949px) {
      :host([columns]) .narrow-hide {
        display: none;
      }

      :host([columns]) .selection-header,
      :host([columns]) .dataset-row {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) 84px;
      }
    }

    .cell .connect-dataset {
      --md-filled-button-container-height: 24px;
      --md-filled-button-with-leading-icon-leading-space: 8px;
      --md-filled-button-with-leading-icon-trailing-space: 14px;
    }

    md-filled-button md-icon {
      color: var(--oscd-plugin-internal-base3);
      font-size: 18px;
    }
  `;
}

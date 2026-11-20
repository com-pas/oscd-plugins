import { css, html, LitElement, nothing, unsafeCSS } from 'lit';
import themeBridgeCss from './theme-bridge.css?inline';
import { property, state } from 'lit/decorators.js';

import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

import { MdIcon } from '@scopedelement/material-web/icon/MdIcon.js';

import { DataSetEditor } from './editors/dataset/data-set-editor.js';
import { GseControlEditor } from './editors/gsecontrol/gse-control-editor.js';
import { ReportControlEditor } from './editors/report/report-control-editor.js';
import { SampledValueControlEditor } from './editors/sampledvalue/sampled-value-control-editor.js';

const EditorSelector = {
  Report: 'report-control-editor',
  GOOSE: 'gse-control-editor',
  SampledValue: 'sampled-value-control-editor',
  DataSet: 'data-set-editor',
} as const;

type PublisherType = 'Report' | 'GOOSE' | 'SampledValue' | 'DataSet';

type EditorSelectorType = (typeof EditorSelector)[keyof typeof EditorSelector];

/** An editor [[`plugin`]] to configure `Report`, `GOOSE`, `SampledValue` control blocks and its `DataSet` */
export default class PublisherPlugin extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'md-icon': MdIcon,
    'report-control-editor': ReportControlEditor,
    'gse-control-editor': GseControlEditor,
    'sampled-value-control-editor': SampledValueControlEditor,
    'data-set-editor': DataSetEditor,
  };

  /** The document being edited as provided to plugins by [[`OpenSCD`]]. */
  @property({ attribute: false })
  doc!: XMLDocument;

  /** SCL change indicator */
  @property({ type: Number })
  editCount = 0;

  @state()
  private publisherType: PublisherType = 'DataSet';

  /** Data set a control list asked to open. Cleared once the editor shows it. */
  @state()
  private focusDataSet: Element | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('open-dataset', this.onOpenDataSet);
    this.addEventListener('dataset-opened', this.onDataSetOpened);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('open-dataset', this.onOpenDataSet);
    this.removeEventListener('dataset-opened', this.onDataSetOpened);
    super.disconnectedCallback();
  }

  private onOpenDataSet = (event: Event): void => {
    const dataSet = (event as CustomEvent<Element>).detail;
    if (!(dataSet instanceof Element)) return;
    this.saveCurrentSearchValue();
    this.focusDataSet = dataSet;
    this.publisherType = 'DataSet';
  };

  private onDataSetOpened = (): void => {
    if (this.focusDataSet !== null) this.focusDataSet = null;
  };

  private filterValues: Record<PublisherType, string> = {
    Report: '',
    GOOSE: '',
    SampledValue: '',
    DataSet: '',
  };

  private saveCurrentSearchValue() {
    const selector: EditorSelectorType = EditorSelector[this.publisherType];
    const editor = this.renderRoot.querySelector(selector) as {
      searchValue?: string;
    } | null;

    if (editor) {
      this.filterValues[this.publisherType] = editor.searchValue || '';
    }
  }

  private handlePublisherTypeChange(newType: PublisherType) {
    this.saveCurrentSearchValue();
    this.publisherType = newType;
  }

  private renderNavItem(type: PublisherType, label: string, icon: string) {
    return html`<button
      type="button"
      class=${this.publisherType === type ? 'active' : ''}
      @click=${() => this.handlePublisherTypeChange(type)}
    >
      <md-icon aria-hidden="true">${icon}</md-icon>
      ${label}
    </button>`;
  }

  private renderEditor() {
    switch (this.publisherType) {
      case 'Report':
        return html`<report-control-editor
          class="editor"
          .doc=${this.doc}
          .editCount=${this.editCount}
          .searchValue=${this.filterValues.Report}
        ></report-control-editor>`;
      case 'GOOSE':
        return html`<gse-control-editor
          class="editor"
          .doc=${this.doc}
          .editCount=${this.editCount}
          .searchValue=${this.filterValues.GOOSE}
        ></gse-control-editor>`;
      case 'SampledValue':
        return html`<sampled-value-control-editor
          class="editor"
          .doc=${this.doc}
          .editCount=${this.editCount}
          .searchValue=${this.filterValues.SampledValue}
        ></sampled-value-control-editor>`;
      case 'DataSet':
        return html`<data-set-editor
          class="editor"
          .doc=${this.doc}
          .editCount=${this.editCount}
          .searchValue=${this.filterValues.DataSet}
          .focusDataSet=${this.focusDataSet}
        ></data-set-editor>`;
      default:
        return nothing;
    }
  }

  render() {
    return html`<nav class="publisher-nav">
        ${this.renderNavItem('DataSet', 'Data Sets', 'dataset')}
        <span class="publisher-nav-divider" role="separator"></span>
        ${this.renderNavItem('Report', 'Reports', 'description')}
        ${this.renderNavItem('GOOSE', 'GOOSE', 'device_hub')}
        ${this.renderNavItem('SampledValue', 'Sample Values', 'graphic_eq')}
      </nav>
      ${this.renderEditor()} `;
  }

  static styles = [
    unsafeCSS(themeBridgeCss),
    css`
      :host {
        --md-icon-font: var(--oscd-plugin-internal-icon-font);
        font-family: var(--oscd-plugin-internal-text-font);
        display: flex;
        flex-direction: column;
      }

      .editor {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      * {
        --md-sys-color-primary: var(--oscd-plugin-internal-primary);
        --md-sys-color-secondary: var(--oscd-plugin-internal-secondary);
        --md-sys-typescale-body-large-font: var(--oscd-plugin-internal-text-font);
        --md-outlined-text-field-input-text-color: var(--oscd-plugin-internal-base01);

        --md-sys-color-surface: var(--oscd-plugin-internal-base3);
        --md-sys-color-on-surface: var(--oscd-plugin-internal-base00);
        --md-sys-color-on-primary: var(--oscd-plugin-internal-base3);
        --md-sys-color-on-surface-variant: var(--oscd-plugin-internal-base00);
        --md-menu-container-color: var(--oscd-plugin-internal-base3);
        --md-sys-color-surface-container-highest: var(--oscd-plugin-internal-base2);
        --md-dialog-container-color: var(--oscd-plugin-internal-base3);
        --md-outlined-button-container-height: 36px;
        --md-outlined-button-outline-color: var(--oscd-plugin-internal-primary);
        --md-filled-button-container-height: 36px;

        --md-list-item-activated-background: color-mix(
          in srgb,
          var(--oscd-plugin-internal-primary) 38%,
          transparent
        );
      }
      .hidden {
        display: none;
      }

      .publisher-nav {
        display: flex;
        align-items: stretch;
        min-height: 48px;
        background-color: var(--oscd-plugin-internal-nav-primary);
      }

      .publisher-nav button {
        appearance: none;
        border: 0;
        margin: 0;
        background-color: var(--oscd-plugin-internal-nav-primary);
        color: var(--oscd-plugin-internal-nav-primary-text);
        font-family: var(--oscd-plugin-internal-text-font);
        font-size: 14px;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 0 16px;
        cursor: pointer;
      }

      .publisher-nav button.active {
        background-color: var(--oscd-plugin-internal-nav-primary-active);
        color: var(--oscd-plugin-internal-nav-primary-text-active);
      }

      .publisher-nav md-icon {
        color: inherit;
        font-size: 20px;
      }

      .publisher-nav-divider {
        width: 1px;
        align-self: stretch;
        margin: 8px 0;
        background-color: color-mix(
          in srgb,
          var(--oscd-plugin-internal-nav-primary-text) 38%,
          transparent
        );
      }
    `,
  ];
}

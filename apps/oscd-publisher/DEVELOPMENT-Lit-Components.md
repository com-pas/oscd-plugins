# UI components in oscd-publisher

This plugin has no component library of its own. Buttons, dialogs, lists, and icons are [Material Web](https://github.com/material-components/material-web) (Material 3, tags such as `md-radio`). They are installed as `@scopedelement/material-web` 3.10.0, a fork of Google's package. SCL fields, the filterable list, and the tree picker come from `@openenergytools/*`.

The old `mwc-*` elements (`@material/mwc-*`) are not a dependency. CSS that still mentions `mwc-list-item` does not match the elements in use.

## How to use one

Import the class and register it on the element that renders the tag. `ScopedElementsMixin` keeps that tag inside the shadow root, so another OpenSCD plugin can load its own copy.

```ts
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { MdTextButton } from '@scopedelement/material-web/button/MdTextButton.js';

class MyEditor extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'md-text-button': MdTextButton,
  };
}
```

`src/main.ts` loads `@webcomponents/scoped-custom-element-registry` for the dev playground only; OpenSCD and CoMPAS already load this polyfill, and without it the mixin cannot isolate the tags.

Import the `Md*.js` file. The kebab-case sibling (`radio.js`, `text-button.js`, `dialog.js`, …) calls Lit's `@customElement()` and defines the tag on `window.customElements`. `src/oscd-publisher.ts` still imports `radio/radio.js`; new code should import `radio/MdRadio.js`.

A child widget that has its own `scopedElements` (for example `scl-text-field`) registers the Material elements it needs. You do not register those inner tags on the editor.

`md-icon` shows a Material Symbols Outlined ligature (`save`, `playlist_add`). The OpenSCD host supplies the font. Colors are the Material system variables `--md-sys-color-*`, which `oscd-publisher.ts` points at `--oscd-plugin-internal-*`.

Three filenames in this fork do not match the class:

| File | What it actually exports |
|------|--------------------------|
| `divider/MdDevider.js` | `MdDivider` |
| `switch/MdSwtich.js` | `MdSwitch` |
| `select/MdOutlineSelect.js` | `MdFilledSelect`, not an outlined select. Use `select/MdFilledSelect.js`. The outlined variant exists only as `select/outlined-select.js`, and that module registers `md-outlined-select` globally. |

## Components this plugin renders

The tag is the key in `static scopedElements`. The class file is the import that does not register a global tag.

| Tag | Class | Package | Import | Role |
|-----|-------|---------|--------|------|
| `md-text-button` | `MdTextButton` | `@scopedelement/material-web` | `button/MdTextButton.js` | Low-emphasis action. Save and dialog buttons. |
| `md-outlined-button` | `MdOutlinedButton` | `@scopedelement/material-web` | `button/MdOutlinedButton.js` | Medium-emphasis action. Change selection, copy. |
| `md-icon-button` | `MdIconButton` | `@scopedelement/material-web` | `iconbutton/MdIconButton.js` | Icon-only action. Add or change a DataSet. |
| `md-icon` | `MdIcon` | `@scopedelement/material-web` | `icon/MdIcon.js` | Ligature icon, also the icon slot of a button. |
| `md-dialog` | `MdDialog` | `@scopedelement/material-web` | `dialog/MdDialog.js` | Modal for copy, LDevice choice, and data pickers. |
| `md-radio` | `MdRadio` | `@scopedelement/material-web` | `radio/MdRadio.js` | Single choice. Publisher type and copy options. |
| `md-checkbox` | `MdCheckbox` | `@scopedelement/material-web` | `checkbox/MdCheckbox.js` | Multi-choice. Which IEDs receive a copy. |
| `md-list` | `MdList` | `@scopedelement/material-web` | `list/MdList.js` | List surface. LDevice picker. |
| `md-list-item` | `MdListItem` | `@scopedelement/material-web` | `list/MdListItem.js` | One row of `md-list`. |
| `scl-text-field` | `SclTextField` | `@openenergytools/scl-text-field` | package root | SCL attribute as text. `value` is `string \| null`, with `nullable` and an optional SI unit. Wraps `md-filled-text-field`. |
| `scl-select` | `SclSelect` | `@openenergytools/scl-select` | package root | SCL enumeration. `value` is `string \| null`. Wraps `md-filled-select`. |
| `scl-checkbox` | `SclCheckbox` | `@openenergytools/scl-checkbox` | package root | SCL boolean. `value` is `'true' \| 'false' \| null`. Wraps `md-checkbox`. |
| `action-list` | `ActionList` | `@openenergytools/filterable-lists` | `dist/ActionList.js` | Filterable list of IEDs, control blocks, DataSets, and FCDAs. Items are `ActionItem` objects, not DOM children. |
| `tree-grid` | `TreeGrid` | `@openenergytools/tree-grid` | package root | Checkable tree for the DO and DA pickers. Pass `.tree` and read `.paths`. |

`@openenergytools/filterable-lists` has no `exports` map, so the import includes `dist/`.

## Other components in the same Material package

Same registration rules. "Scoped import" is safe to import. "Global on import" means the only module calls `@customElement()`.

| Tag | Class | Import | Role | Registration |
|-----|-------|--------|------|----------------|
| `md-filled-button` | `MdFilledButton` | `button/MdFilledButton.js` | High-emphasis button. | Scoped import |
| `md-elevated-button` | `MdElevatedButton` | `button/MdElevatedButton.js` | Button with a shadow. | Scoped import |
| `md-filled-tonal-button` | `MdFilledTonalButton` | `button/filled-tonal-button.js` | Medium-emphasis filled button. | Global on import |
| `md-filled-icon-button` | `MdFilledIconButton` | `iconbutton/filled-icon-button.js` | Filled icon button. | Global on import |
| `md-filled-tonal-icon-button` | `MdFilledTonalIconButton` | `iconbutton/filled-tonal-icon-button.js` | Tonal icon button. | Global on import |
| `md-outlined-icon-button` | `MdOutlinedIconButton` | `iconbutton/outlined-icon-button.js` | Outlined icon button. | Global on import |
| `md-fab` | `MdFab` | `fab/MdFab.js` | Floating action button. | Scoped import |
| `md-branded-fab` | `MdBrandedFab` | `fab/branded-fab.js` | FAB with a brand icon. | Global on import |
| `md-checkbox` | `MdCheckbox` | `checkbox/MdCheckbox.js` | Already used. Also the control inside `scl-checkbox`. | Scoped import |
| `md-radio` | `MdRadio` | `radio/MdRadio.js` | Already used. | Scoped import |
| `md-switch` | `MdSwitch` | `switch/MdSwtich.js` | On/off. Used inside `scl-text-field` and `scl-checkbox` for the null switch. | Scoped import |
| `md-filled-text-field` | `MdFilledTextField` | `textfield/MdFilledTextField.js` | Filled text field. Inner control of `scl-text-field`. | Scoped import |
| `md-outlined-text-field` | `MdOutlinedTextField` | `textfield/MdOutlinedTextField.js` | Outlined text field. Filter box of `action-list` and `tree-grid`. | Scoped import |
| `md-filled-field` | `MdFilledField` | `field/MdFilledField.js` | Field chrome used by filled inputs. Not a control by itself. | Scoped import |
| `md-outlined-field` | `MdOutlinedField` | `field/MdOutlinedField.js` | Field chrome used by outlined inputs. | Scoped import |
| `md-filled-select` | `MdFilledSelect` | `select/MdFilledSelect.js` | Filled select. Inner control of `scl-select`. | Scoped import |
| `md-outlined-select` | `MdOutlinedSelect` | `select/outlined-select.js` | Outlined select. | Global on import |
| `md-select-option` | `MdSelectOption` | `select/MdSelectOption.js` | One option of a select. | Scoped import |
| `md-list` | `MdList` | `list/MdList.js` | Already used. Also the rows of `action-list` and `tree-grid`. | Scoped import |
| `md-list-item` | `MdListItem` | `list/MdListItem.js` | Already used. | Scoped import |
| `md-menu` | `MdMenu` | `menu/MdMenu.js` | Popup menu. Used inside `action-list` and `scl-text-field`. | Scoped import |
| `md-menu-item` | `MdMenuItem` | `menu/MdMenuItem.js` | One menu row. | Scoped import |
| `md-sub-menu` | `MdSubMenu` | `menu/sub-menu.js` | Nested menu. | Global on import |
| `md-dialog` | `MdDialog` | `dialog/MdDialog.js` | Already used. | Scoped import |
| `md-divider` | `MdDivider` | `divider/MdDevider.js` | Hairline. Drawn by `action-list` between groups. | Scoped import |
| `md-icon` | `MdIcon` | `icon/MdIcon.js` | Already used. | Scoped import |
| `md-chip-set` | `MdChipSet` | `chips/chip-set.js` | Row of chips. | Global on import |
| `md-assist-chip` | `MdAssistChip` | `chips/assist-chip.js` | Chip that starts an action. | Global on import |
| `md-filter-chip` | `MdFilterChip` | `chips/filter-chip.js` | Toggle chip for a filter. | Global on import |
| `md-input-chip` | `MdInputChip` | `chips/input-chip.js` | Removable input chip. | Global on import |
| `md-suggestion-chip` | `MdSuggestionChip` | `chips/suggestion-chip.js` | Suggested choice chip. | Global on import |
| `md-tabs` | `MdTabs` | `tabs/tabs.js` | Tab bar. | Global on import |
| `md-primary-tab` | `MdPrimaryTab` | `tabs/primary-tab.js` | Primary tab. | Global on import |
| `md-secondary-tab` | `MdSecondaryTab` | `tabs/secondary-tab.js` | Secondary tab. | Global on import |
| `md-linear-progress` | `MdLinearProgress` | `progress/linear-progress.js` | Linear progress. | Global on import |
| `md-circular-progress` | `MdCircularProgress` | `progress/circular-progress.js` | Circular progress. | Global on import |
| `md-slider` | `MdSlider` | `slider/slider.js` | Numeric slider. | Global on import |
| `md-elevation` | `MdElevation` | `elevation/MdElevation.js` | Shadow overlay. Usually left inside other components. | Scoped import |
| `md-ripple` | `MdRipple` | `ripple/MdRipple.js` | Touch ripple. Used inside buttons. | Scoped import |
| `md-focus-ring` | `MdFocusRing` | `focus/MdFocusRing.js` | Keyboard focus ring. Used inside buttons. | Scoped import |

`@openenergytools/filterable-lists` also exports `SelectionList` from `dist/SelectionList.js`. It is a filterable multi-select (`SelectItem[]`, read `selectedElements`). This plugin does not register it. Its `renderSelectionList()` methods build an `action-list`, not a `SelectionList`.

## Labs

These live under `@scopedelement/material-web/labs/` and are not used here. Their modules call `@customElement()`, so importing one defines the tag globally. Treat them as unstable.

| Tag | Class | Import |
|-----|-------|--------|
| `md-badge` | `MdBadge` | `labs/badge/badge.js` |
| `md-elevated-card` | `MdElevatedCard` | `labs/card/elevated-card.js` |
| `md-filled-card` | `MdFilledCard` | `labs/card/filled-card.js` |
| `md-outlined-card` | `MdOutlinedCard` | `labs/card/outlined-card.js` |
| `md-item` | `MdItem` | `labs/item/MdItem.js` |
| `md-navigation-bar` | `MdNavigationBar` | `labs/navigationbar/navigation-bar.js` |
| `md-navigation-tab` | `MdNavigationTab` | `labs/navigationtab/navigation-tab.js` |
| `md-navigation-drawer` | `MdNavigationDrawer` | `labs/navigationdrawer/navigation-drawer.js` |
| `md-navigation-drawer-modal` | `MdNavigationDrawerModal` | `labs/navigationdrawer/navigation-drawer-modal.js` |
| `md-outlined-segmented-button` | `MdOutlinedSegmentedButton` | `labs/segmentedbutton/outlined-segmented-button.js` |
| `md-outlined-segmented-button-set` | `MdOutlinedSegmentedButtonSet` | `labs/segmentedbuttonset/outlined-segmented-button-set.js` |

`labs/item/MdItem.js` is the one labs class that does not call `@customElement()`. The sibling `labs/item/item.js` is what defines `md-item` globally.

## Shared publisher components

Used by more than one screen. Register the tag on the editor that renders it.

| Tag | Class | File |
|-----|-------|------|
| `publisher-selection-list` | `PublisherSelectionList` | `src/shared/components/publisher-selection-list.ts` |
| `publisher-text-field` | `PublisherTextField` | `src/shared/components/publisher-text-field.ts` |
| `publisher-checkbox` | `PublisherCheckbox` | `src/shared/components/publisher-checkbox.ts` |
| `publisher-radio` | `PublisherRadio` | `src/shared/components/publisher-radio.ts` |
| `publisher-select` | `PublisherSelect` | `src/shared/components/publisher-select.ts` |
| `publisher-edit-dialog` | `PublisherEditDialog` | `src/shared/components/publisher-edit-dialog.ts` |
| `publisher-ldevice-select-dialog` | `PublisherLDeviceSelectDialog` | `src/shared/components/publisher-ldevice-select-dialog.ts` |

The list owns search, expand, and collapse. The editor passes groups and two render callbacks: one row, and an optional action on the group header. `visibleRows` decides which rows a search shows. `searchValue` is a real property. DataSet, Report, GOOSE, and Sampled Value use it for the selection overview. The DataSet picker inside a control still uses `action-list`. `renderHeader` and the `columns` attribute are optional. With `columns`, the header and each row share `--selection-columns`. GOOSE, Report, and Sampled Value set them. DataSet stays on the name, path, and actions row. Search stays outside `.list-scroll`. That element scrolls the header and the groups. The column header sticks to the top of that scroll. It is omitted while every visible group is collapsed. Add on DataSet, GOOSE, Report, and Sampled Value opens the edit dialog with the scl-lib defaults. The entry is written when that dialog's Add button is used. Cancel writes nothing. That plus is disabled, gray, and `not-allowed` when the IED cannot take another entry. The tooltip is the reason. An LDevice that cannot take the entry stays in the picker and is disabled the same way. DataSet, GOOSE, Report, and Sampled Value open `publisher-ldevice-select-dialog` when the IED has more than one LDevice. One LDevice opens the edit dialog directly. The caller passes the intro sentence and `blockReason`.

`publisher-text-field` is an outlined field. `value` is `string | null`. `nullable` shows a lock in a fixed left column. Without `nullable` that column stays empty, so every field has the same width. A closed lock reports `null` and shows the label as placeholder. The typed text comes back when the lock opens. An empty open field is `''`. `publisher-checkbox` reports `'true'`, `'false'`, or `null` while locked. `publisher-radio` and `publisher-select` report the selected value, or `null` while locked. An open radio with no selection is `null`. An open select with no selection is `''`. The GOOSE, Report, and Sampled Value edit dialogs use all four.

`publisher-edit-dialog` is the shared edit shell. It draws the dark title, the base2 body, the base3 actions, and the dialog shadow. Callers set `--publisher-edit-dialog-width`. The default slot is the body. The `actions` slot is the buttons. `publisherEditCardStyles` is the white card. The GOOSE, Report, and Sampled Value dialogs are 1200px and two columns. The DataSet dialog is 640px with one General card.

## Local editor elements

These tags are this plugin's screens, registered the same way. They are not a shared package.

| Tag | Class | File |
|-----|-------|------|
| `report-control-editor` | `ReportControlEditor` | `src/editors/report/report-control-editor.ts` |
| `report-control-edit-dialog` | `ReportControlEditDialog` | `src/editors/report/report-control-edit-dialog.ts` |
| `gse-control-editor` | `GseControlEditor` | `src/editors/gsecontrol/gse-control-editor.ts` |
| `gse-control-edit-dialog` | `GseControlEditDialog` | `src/editors/gsecontrol/gse-control-edit-dialog.ts` |
| `sampled-value-control-editor` | `SampledValueControlEditor` | `src/editors/sampledvalue/sampled-value-control-editor.ts` |
| `sampled-value-control-edit-dialog` | `SampledValueControlEditDialog` | `src/editors/sampledvalue/sampled-value-control-edit-dialog.ts` |
| `data-set-editor` | `DataSetEditor` | `src/editors/dataset/data-set-editor.ts` |
| `data-set-element-editor` | `DataSetElementEditor` | `src/editors/dataset/data-set-element-editor.ts` |
| `data-set-edit-dialog` | `DataSetEditDialog` | `src/editors/dataset/data-set-edit-dialog.ts` |

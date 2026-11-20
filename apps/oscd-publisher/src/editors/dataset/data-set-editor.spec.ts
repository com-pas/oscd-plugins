import { afterEach, beforeEach, expect, it } from 'vitest';

import { isInsert, isRemove } from '@openenergytools/scl-lib/dist/foundation/utils.js';

import { dataSetDoc, dataSetCopyDoc } from './data-set-editor.testfiles.js';
import { DataSetEditor } from './data-set-editor.js';
import {
  clickCreateAdd,
  describeLitEditor,
  lastDetail,
  listenEvent,
  mountLit,
} from '../../test/lit-fixture.js';

const doc = new DOMParser().parseFromString(dataSetDoc, 'application/xml');

function listRoot(editor: DataSetEditor): ShadowRoot {
  const list = editor.shadowRoot?.querySelector('publisher-selection-list');
  if (!list?.shadowRoot) throw new Error('publisher-selection-list missing');
  return list.shadowRoot;
}

describeLitEditor('DataSet editor component', () => {
  let editor: DataSetEditor;
  let edits: ReturnType<typeof listenEvent>;

  beforeEach(async () => {
    editor = await mountLit('data-set-editor', DataSetEditor, { doc });
    edits = listenEvent('oscd-edit-v2');
  });

  afterEach(() => {
    edits.stop();
    editor.remove();
  });

  it('opens a collapsed IED group only after the DataSet is created', async () => {
    const group = listRoot(editor).querySelector('.ied-group')!;
    (group.querySelector('.ied-chevron') as HTMLElement).click();
    await editor.updateComplete;
    expect(group.querySelector('.ied-toggle')?.getAttribute('aria-expanded')).toBe('false');

    (group.querySelector('.ied-add') as HTMLElement).click();
    await editor.updateComplete;
    expect(group.querySelector('.ied-toggle')?.getAttribute('aria-expanded')).toBe('false');

    const dialog = editor.lDeviceSelectDialog.shadowRoot!;
    const radio = dialog.querySelector(
      'md-list-item:nth-child(2) md-radio',
    ) as HTMLElement;
    radio.click();
    await editor.updateComplete;
    (dialog.querySelector('md-filled-button.ldevice.select') as HTMLElement).click();
    await editor.updateComplete;
    expect(
      listRoot(editor).querySelector('.ied-toggle')?.getAttribute('aria-expanded'),
    ).toBe('false');
    expect(edits.handler).not.toHaveBeenCalled();

    await clickCreateAdd(editor, 'data-set-edit-dialog', '.dataset.save');

    const open = listRoot(editor).querySelector('.ied-group')!;
    expect(open.querySelector('.ied-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(open.querySelector('.dataset-rows')).toBeTruthy();
    expect(edits.handler).toHaveBeenCalledOnce();
  });

  it('allows to add a new empty DataSet element directly if only one LDevice is available', async () => {
    const copyDoc = doc.cloneNode(true) as XMLDocument;
    const ied = copyDoc.querySelector('IED[name="IED"]')!;
    ied
      .querySelectorAll(':scope > AccessPoint > Server > LDevice')
      .forEach((ld) => {
        if (ld.getAttribute('inst') !== 'ldInst1') ld.remove();
      });

    editor.remove();
    editor = await mountLit('data-set-editor', DataSetEditor, { doc: copyDoc });

    (listRoot(editor).querySelector('.ied-add') as HTMLElement).click();
    await editor.updateComplete;
    expect(edits.handler).not.toHaveBeenCalled();

    await clickCreateAdd(editor, 'data-set-edit-dialog', '.dataset.save');

    expect(edits.handler).toHaveBeenCalledOnce();
    const insert = lastDetail(edits.handler).edit as {
      parent: Element;
      node: Element;
    };
    expect(isInsert(insert)).toBe(true);
    expect(insert.parent.tagName).toBe('LN0');
    expect(insert.node.tagName).toBe('DataSet');
    expect(insert.node.getAttribute('name')).toBe('newDataSet_001');
    expect(insert.node.children.length).toBe(0);
  });

  it('allows to add a new empty DataSet element to a selected LDevice if multiple LDevices are available', async () => {
    (listRoot(editor).querySelector('.ied-add') as HTMLElement).click();
    await editor.updateComplete;

    const dialog = editor.lDeviceSelectDialog.shadowRoot!;
    const radio = dialog
      .querySelector('md-list')
      ?.querySelector('md-list-item:nth-child(2)')
      ?.querySelector('md-radio') as HTMLElement;
    radio.click();
    await editor.updateComplete;

    (dialog.querySelector('md-filled-button.ldevice.select') as HTMLElement).click();
    await editor.updateComplete;
    expect(edits.handler).not.toHaveBeenCalled();

    await clickCreateAdd(editor, 'data-set-edit-dialog', '.dataset.save');

    expect(edits.handler).toHaveBeenCalledOnce();
    const insert = lastDetail(edits.handler).edit as {
      parent: Element;
      node: Element;
    };
    expect(isInsert(insert)).toBe(true);
    expect(insert.parent.tagName).toBe('LN0');
    expect(insert.node.tagName).toBe('DataSet');
    expect(insert.node.getAttribute('name')).toBe('newDataSet_001');
    expect(insert.node.children.length).toBe(0);
  });

  it('opens a data set chosen from a control list', async () => {
    const dataSet = doc.querySelector('DataSet[name="datSet"]');
    if (!dataSet) throw new Error('datSet missing');
    editor.focusDataSet = dataSet;
    await editor.updateComplete;
    expect(editor.selectedDataSet).toBe(dataSet);
    expect(editor.shadowRoot?.querySelector('.elementeditorcontainer')).toBeTruthy();
  });

  it('closes the detail when the selected data set is clicked again', async () => {
    const row = () => listRoot(editor).querySelector('.dataset-row') as HTMLElement;
    row().click();
    await editor.updateComplete;
    expect(editor.selectedDataSet).toBeTruthy();
    row().click();
    await editor.updateComplete;
    expect(editor.selectedDataSet).toBeUndefined();
    expect(editor.shadowRoot?.querySelector('.elementeditorcontainer')).toBeNull();
    expect(
      editor.shadowRoot
        ?.querySelector('publisher-selection-list')
        ?.classList.contains('hidden'),
    ).toBe(false);
  });

  it('keeps the dataset overview as name, path, and actions', () => {
    const root = listRoot(editor);
    expect(root.querySelector('.selection-header')).toBeNull();
    const row = root.querySelector('.dataset-row');
    expect(row?.querySelector('.dataset-name')).toBeTruthy();
    expect(row?.querySelector('.dataset-path')).toBeTruthy();
    expect(row?.querySelector('.dataset-actions')).toBeTruthy();
    expect(row?.querySelector('.connect-dataset')).toBeNull();
  });

  it('starts with every IED group expanded', () => {
    const root = listRoot(editor);
    const toggles = [...root.querySelectorAll('.ied-toggle')] as HTMLElement[];
    expect(toggles.length).toBeGreaterThan(0);
    for (const toggle of toggles) {
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
    }
    expect(root.querySelectorAll('.dataset-rows').length).toBe(toggles.length);
  });

  it('lets a chevron collapse a group while a search is active', async () => {
    editor.searchValue = 'datSet';
    await editor.updateComplete;

    const group = listRoot(editor).querySelector('.ied-group')!;
    (group.querySelector('.ied-chevron') as HTMLButtonElement).click();
    await editor.updateComplete;

    expect(
      group.querySelector('.ied-toggle')!.getAttribute('aria-expanded'),
    ).toBe('false');
    expect(group.querySelector('.dataset-rows')).toBeNull();
  });

  it('allows to remove an existing DataSet element', async () => {
    (listRoot(editor).querySelector('.dataset-delete') as HTMLElement).click();
    expect(edits.handler).toHaveBeenCalledOnce();
    const remove = (lastDetail(edits.handler).edit as { node: Element }[])[0];
    expect(isRemove(remove)).toBe(true);
    expect(remove.node.tagName).toBe('DataSet');
  });

  it('keeps searchValue on the DataSet list when passed as a prop', async () => {
    editor.remove();
    const el = await mountLit('data-set-editor', DataSetEditor, {
      doc,
      searchValue: 'IED1',
    });
    await el.updateComplete;
    expect(el.selectionList).toBeTruthy();
    expect(el.selectionList.searchValue).toBe('IED1');
    el.remove();
  });
});

describeLitEditor('DataSet copy', () => {
  const copyDoc = new DOMParser().parseFromString(
    dataSetCopyDoc,
    'application/xml',
  );

  let editor: DataSetEditor;
  let edits: ReturnType<typeof listenEvent>;

  beforeEach(async () => {
    editor = await mountLit('data-set-editor', DataSetEditor, { doc: copyDoc });
    edits = listenEvent('oscd-edit-v2');
  });

  afterEach(() => {
    edits.stop();
    editor.remove();
  });

  it('determines CanCopy status when target IED has matching structure and no conflict', () => {
    const dataSet = copyDoc.querySelector(
      'IED[name="IED"] DataSet[name="datSet"]',
    )!;
    const ied2 = copyDoc.querySelector('IED[name="IED2"]')!;
    expect((editor as unknown as { getDataSetCopyStatus: (dataSet: Element, ied: Element) => string }).getDataSetCopyStatus(dataSet, ied2)).toBe(
      'CanCopy',
    );
  });

  it('determines DataSetAlreadyExists when target IED has a DataSet with the same name', () => {
    const dataSet = copyDoc.querySelector(
      'IED[name="IED"] DataSet[name="datSet"]',
    )!;
    const ied3 = copyDoc.querySelector('IED[name="IED3"]')!;
    expect((editor as unknown as { getDataSetCopyStatus: (dataSet: Element, ied: Element) => string }).getDataSetCopyStatus(dataSet, ied3)).toBe(
      'DataSetAlreadyExists',
    );
  });

  it('determines IEDStructureIncompatible when target IED has no matching LDevice', () => {
    const dataSet = copyDoc.querySelector(
      'IED[name="IED"] DataSet[name="datSet"]',
    )!;
    const ied4 = copyDoc.querySelector('IED[name="IED4"]')!;
    expect((editor as unknown as { getDataSetCopyStatus: (dataSet: Element, ied: Element) => string }).getDataSetCopyStatus(dataSet, ied4)).toBe(
      'IEDStructureIncompatible',
    );
  });

  it('pre-selects only CanCopy IEDs when copy dialog is opened', async () => {
    const dataSet = copyDoc.querySelector(
      'IED[name="IED"] DataSet[name="datSet"]',
    )!;
    editor.dataSetCopyOptions = ['IED2', 'IED3', 'IED4'].map((name) => {
      const ied = copyDoc.querySelector(`IED[name="${name}"]`)!;
      const status = (
        editor as unknown as { getDataSetCopyStatus: (dataSet: Element, ied: Element) => string }
      ).getDataSetCopyStatus(dataSet, ied);
      return { ied, dataSet, status, selected: status === 'CanCopy' };
    });
    await editor.updateComplete;

    expect(
      editor.dataSetCopyOptions.find((o) => o.ied.getAttribute('name') === 'IED2')
        ?.selected,
    ).toBe(true);
    expect(
      editor.dataSetCopyOptions.find((o) => o.ied.getAttribute('name') === 'IED3')
        ?.selected,
    ).toBe(false);
    expect(
      editor.dataSetCopyOptions.find((o) => o.ied.getAttribute('name') === 'IED4')
        ?.selected,
    ).toBe(false);
  });

  it('dispatches an insert edit event for each selected IED when copying', async () => {
    const dataSet = copyDoc.querySelector(
      'IED[name="IED"] DataSet[name="datSet"]',
    )!;
    const ied2 = copyDoc.querySelector('IED[name="IED2"]')!;
    editor.dataSetCopyOptions = [
      { ied: ied2, dataSet, status: 'CanCopy' as never, selected: true },
    ];
    await editor.updateComplete;
    (editor as unknown as { copyDataSet: () => void }).copyDataSet();

    expect(edits.handler).toHaveBeenCalledOnce();
    const inserts = lastDetail(edits.handler).edit as {
      parent: Element;
      node: Element;
      reference: Element | null;
    }[];
    expect(inserts).toHaveLength(1);
    expect(isInsert(inserts[0])).toBe(true);
    expect(inserts[0].parent.tagName).toBe('LN0');
    expect(inserts[0].node.tagName).toBe('DataSet');
    expect(inserts[0].node.getAttribute('name')).toBe('datSet');
    expect(inserts[0].reference).toBe(inserts[0].parent.querySelector(':scope > GSEControl'));
  });

  it('does not dispatch an edit event when no IED is selected', async () => {
    const dataSet = copyDoc.querySelector(
      'IED[name="IED"] DataSet[name="datSet"]',
    )!;
    const ied2 = copyDoc.querySelector('IED[name="IED2"]')!;
    editor.dataSetCopyOptions = [
      { ied: ied2, dataSet, status: 'CanCopy' as never, selected: false },
    ];
    await editor.updateComplete;
    (editor as unknown as { copyDataSet: () => void }).copyDataSet();
    expect(edits.handler).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import {
  isInsert,
  isRemove,
  isUpdate,
} from '@openenergytools/scl-lib/dist/foundation/utils.js';

import { reportControlDoc } from './reportControl.testfiles.js';
import { ReportControlEditor } from './report-control-editor.js';
import {
  actionItems,
  clickCreateAdd,
  clickDetailDataSetAdd,
  clickSelection,
  describeLitEditor,
  lastDetail,
  listenEvent,
  mountLit,
  selectionListRoot,
} from '../../test/lit-fixture.js';

const doc = new DOMParser().parseFromString(
  reportControlDoc,
  'application/xml',
);

function lDevice(owner: XMLDocument, inst: string, withLn0 = false): Element {
  const device = owner.createElement('LDevice');
  device.setAttribute('inst', inst);
  if (withLn0) {
    const ln0 = owner.createElement('LN0');
    ln0.setAttribute('lnClass', 'LLN0');
    ln0.setAttribute('inst', '');
    device.append(ln0);
  }
  return device;
}

function lDeviceChoice(dialog: ShadowRoot, inst: string): HTMLElement {
  const choice = [...dialog.querySelectorAll('.ldevice-choice')].find(
    item => item.querySelector('label')?.textContent === inst,
  );
  if (!(choice instanceof HTMLElement)) throw new Error(`missing ${inst}`);
  return choice;
}

describeLitEditor('ReportControl editor component', () => {
  let editor: ReportControlEditor;
  let edits: ReturnType<typeof listenEvent>;

  beforeEach(async () => {
    editor = await mountLit('report-control-editor', ReportControlEditor, {
      doc,
    });
    edits = listenEvent('oscd-edit-v2');
  });

  afterEach(() => {
    edits.stop();
    editor.remove();
  });

  it('opens a collapsed IED group after adding a Report', async () => {
    const group = selectionListRoot(editor).querySelector('.ied-group')!;
    (group.querySelector('.ied-chevron') as HTMLElement).click();
    await editor.updateComplete;
    expect(group.querySelector('.ied-toggle')?.getAttribute('aria-expanded')).toBe('false');

    (group.querySelector('.ied-add') as HTMLElement).click();
    await editor.updateComplete;
    expect(edits.handler).not.toHaveBeenCalled();
    await clickCreateAdd(editor, 'report-control-edit-dialog', '.report.save');

    const open = selectionListRoot(editor).querySelector('.ied-group')!;
    expect(open.querySelector('.ied-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(open.querySelector('.dataset-rows')).toBeTruthy();
    expect(edits.handler).toHaveBeenCalledOnce();
  });

  it('allows to insert new ReportControl element', async () => {
    clickSelection(editor, '.ied-add');
    expect(edits.handler).not.toHaveBeenCalled();
    await clickCreateAdd(editor, 'report-control-edit-dialog', '.report.save');
    expect(edits.handler).toHaveBeenCalledOnce();
    const insert = lastDetail(edits.handler).edit as {
      parent: Element;
      node: Element;
    };
    expect(isInsert(insert)).toBe(true);
    expect(insert.parent.tagName).toBe('LN0');
    expect(insert.node.tagName).toBe('ReportControl');
  });

  it('adds a Report on the selected LDevice when the IED has several', async () => {
    const copyDoc = doc.cloneNode(true) as XMLDocument;
    const server = copyDoc.querySelector('IED[name="IED"] > AccessPoint > Server');
    if (!server) throw new Error('missing server');
    server.append(lDevice(copyDoc, 'plain'), lDevice(copyDoc, 'chosen', true));
    editor.remove();
    editor = await mountLit('report-control-editor', ReportControlEditor, { doc: copyDoc });

    clickSelection(editor, '.ied-add');
    await editor.updateComplete;
    expect(edits.handler).not.toHaveBeenCalled();

    const dialog = editor.lDeviceSelectDialog.shadowRoot!;
    const blocked = lDeviceChoice(dialog, 'plain');
    expect(blocked.querySelector('md-radio')?.hasAttribute('disabled')).toBe(true);
    expect(blocked.getAttribute('title')).toBe('This LDevice has no LN0 or LN.');

    (lDeviceChoice(dialog, 'chosen').querySelector('md-radio') as HTMLElement).click();
    await editor.updateComplete;
    (dialog.querySelector('md-filled-button.ldevice.select') as HTMLElement).click();
    await editor.updateComplete;
    expect(edits.handler).not.toHaveBeenCalled();

    await clickCreateAdd(editor, 'report-control-edit-dialog', '.report.save');
    const insert = lastDetail(edits.handler).edit as { parent: Element; node: Element };
    expect(isInsert(insert)).toBe(true);
    expect(insert.node.tagName).toBe('ReportControl');
    expect(insert.parent.closest('LDevice')?.getAttribute('inst')).toBe('chosen');
  });

  it('allows to remove and existing ReportControl element', async () => {
    clickSelection(editor, '.dataset-delete');
    expect(edits.handler).toHaveBeenCalledOnce();
    const remove = (lastDetail(edits.handler).edit as { node: Element }[])[0];
    expect(isRemove(remove)).toBe(true);
    expect(remove.node.tagName).toBe('ReportControl');
  });

  it('allows to insert new DataSet and link with existing ReportControl', async () => {
    clickSelection(editor, '.dataset-row');
    await editor.updateComplete;
    editor.newDataSet.click();
    expect(edits.handler).not.toHaveBeenCalled();
    await clickDetailDataSetAdd(editor);
    expect(edits.handler).toHaveBeenCalledOnce();
    const insert = (lastDetail(edits.handler).edit as { parent: Element; node: Element }[])[0];
    expect(isInsert(insert)).toBe(true);
    expect(insert.parent.tagName).toBe('LN0');
    expect(insert.node.tagName).toBe('DataSet');
  });

  it('edits a Report from the list and leaves the detail closed', async () => {
    const root = selectionListRoot(editor);
    const rp2 = [...root.querySelectorAll('.dataset-row')].find(
      row => row.querySelector('.dataset-name')?.textContent === 'rp2',
    );
    const labels = [...(rp2?.querySelectorAll('.dataset-actions button') ?? [])].map(
      button => button.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['Edit Report', 'Copy Report', 'Remove Report']);

    (rp2?.querySelector('.dataset-edit') as HTMLElement).click();
    await editor.updateComplete;
    expect(editor.selectCtrlBlock).toBeUndefined();
    expect(editor.shadowRoot?.querySelector('.elementeditorcontainer')).toBeNull();
    expect(editor.shadowRoot?.querySelector('report-control-element-editor')).toBeNull();
    const dialog = editor.shadowRoot?.querySelector('report-control-edit-dialog');
    expect(
      (dialog as { control?: Element } | null)?.control?.getAttribute('name'),
    ).toBe('rp2');
  });

  it('hides the column header while every visible group is collapsed', async () => {
    const root = selectionListRoot(editor);
    (root.querySelector('[aria-label="Collapse all"]') as HTMLElement).click();
    await editor.updateComplete;
    expect(root.querySelector('.selection-header')).toBeNull();
    expect(root.querySelector('.dataset-row')).toBeNull();

    (root.querySelector('[aria-label="Expand all"]') as HTMLElement).click();
    await editor.updateComplete;
    expect(root.querySelector('.selection-header')?.textContent).toContain(
      'Report Control',
    );

    (root.querySelector('.ied-chevron') as HTMLElement).click();
    await editor.updateComplete;
    expect(root.querySelector('.selection-header')).toBeTruthy();
    expect(root.querySelectorAll('.ied-group').length).toBeGreaterThan(1);
  });

  it('shows the report columns and connects a data set without opening the detail', async () => {
    const root = selectionListRoot(editor);
    const header = [...(root.querySelector('.selection-header')?.children ?? [])].map(
      cell => cell.textContent,
    );
    expect(header).toEqual([
      'Report Control',
      'Connected Data Set',
      'Clients',
      'confRev',
      'Buffered',
      'Buffer Time',
      'Indexed',
      'intgPd',
      'Report Control ID',
      '',
    ]);
    const headerCells = [...(root.querySelector('.selection-header')?.children ?? [])];
    expect(
      headerCells
        .filter(cell => !cell.classList.contains('narrow-hide'))
        .map(cell => cell.textContent),
    ).toEqual(['Report Control', 'Connected Data Set', '']);

    const row = (name: string) =>
      [...root.querySelectorAll('.dataset-row')].find(
        item => item.querySelector('.dataset-name')?.textContent === name,
      );

    const rp1 = row('rp1');
    const rp2 = row('rp2');
    const rp3 = row('rp3');
    expect(rp2?.querySelector('.dataset-path')).toBeNull();
    expect(rp2?.querySelector('button.dataset-connected')?.textContent).toBe('datSet');
    expect(
      [...(rp2?.children ?? [])].filter(cell => !cell.classList.contains('narrow-hide')),
    ).toHaveLength(3);
    expect(rp2?.querySelector('.conf-rev')?.textContent).toBe('53');
    expect(rp2?.querySelector('.buffered')?.textContent).toBe('True');
    expect(rp2?.querySelector('.buf-time')?.textContent).toBe('100');
    expect(rp2?.querySelector('.indexed')?.textContent).toBe('True');
    expect(rp2?.querySelector('.intg-pd')?.textContent).toBe('1000');
    expect(rp2?.querySelector('.rpt-id')?.textContent).toBe('someID');
    expect(rp2?.querySelector('.clients')?.textContent).toBe('0/5');

    expect(rp1?.querySelector('.rpt-id')?.textContent).toBe('');
    expect(rp1?.querySelector('.clients')?.textContent).toBe('0/1');
    expect(rp1?.querySelector('.conf-rev')?.textContent).toBe('-');
    expect(rp1?.querySelector('.buffered')?.textContent).toBe('True');
    expect(rp1?.querySelector('.indexed')?.textContent).toBe('-');

    expect(rp3?.querySelector('.connect-dataset')).toBeTruthy();
    expect(rp3?.querySelector('.buffered')?.textContent).toBe('False');
    expect(rp3?.querySelector('.buf-time')?.textContent).toBe('-');
    expect(rp3?.querySelector('.intg-pd')?.textContent).toBe('-');

    (rp3?.querySelector('.connect-dataset') as HTMLElement).click();
    await editor.updateComplete;
    expect(editor.selectCtrlBlock).toBeUndefined();
    expect(editor.shadowRoot?.querySelector('.elementeditorcontainer')).toBeNull();

    const dialogItems = actionItems(
      editor,
      'md-dialog.dialog.select action-list',
    );
    dialogItems.find(item => item.headline === 'datSet')?.primaryAction?.();
    expect(edits.handler).toHaveBeenCalledOnce();
    const update = lastDetail(edits.handler).edit as {
      element: Element;
      attributes: { datSet: string };
    };
    expect(isUpdate(update)).toBe(true);
    expect(update.element.getAttribute('name')).toBe('rp3');
    expect(update.attributes.datSet).toBe('datSet');
  });

  it('allows to change an existing DataSet', async () => {
    const rp2 = [...selectionListRoot(editor).querySelectorAll('.dataset-row')].find(
      (row) => row.querySelector('.dataset-name')?.textContent === 'rp2',
    );
    if (!(rp2 instanceof HTMLElement)) throw new Error('rp2 missing');
    rp2.click();
    await editor.updateComplete;
    editor.changeDataSet.click();
    await editor.updateComplete;
    const dialogItems = actionItems(
      editor,
      'md-dialog.dialog.select action-list',
    );
    dialogItems.find((item) => item.headline === 'datSet2')?.primaryAction?.();
    expect(edits.handler).toHaveBeenCalledOnce();
    const update = lastDetail(edits.handler).edit as {
      element: Element;
      attributes: { datSet: string };
    };
    expect(isUpdate(update)).toBe(true);
    expect(update.element.tagName).toBe('ReportControl');
    expect(update.attributes.datSet).toBe('datSet2');
  });

  it('hides the column header when no report row is visible', async () => {
    const root = selectionListRoot(editor);
    expect(root.querySelector('.search-icon')?.textContent).toBe('search');
    const input = root.querySelector('.dataset-search') as HTMLInputElement;
    vi.useFakeTimers();
    try {
      input.value = 'zzz-no-such-report';
      input.dispatchEvent(new Event('input'));
      await vi.advanceTimersByTimeAsync(200);
      await editor.selectionList.updateComplete;
    } finally {
      vi.useRealTimers();
    }
    expect(root.querySelector('.selection-header')).toBeNull();
    expect(root.querySelector('.dataset-row')).toBeNull();
  });

  it('closes the detail when the selected report is clicked again', async () => {
    const row = () =>
      [...selectionListRoot(editor).querySelectorAll('.dataset-row')].find(
        item => item.querySelector('.dataset-name')?.textContent === 'rp2',
      ) as HTMLElement;
    row().click();
    await editor.updateComplete;
    expect(editor.shadowRoot?.querySelector('.elementeditorcontainer')).toBeTruthy();
    row().click();
    await editor.updateComplete;
    expect(editor.selectCtrlBlock).toBeUndefined();
    expect(editor.shadowRoot?.querySelector('.elementeditorcontainer')).toBeNull();
    expect(
      editor.shadowRoot
        ?.querySelector('publisher-selection-list')
        ?.classList.contains('hidden'),
    ).toBe(false);
  });

  it('opens the linked data set without opening the report detail', async () => {
    let opened: Element | undefined;
    editor.addEventListener('open-dataset', event => {
      opened = (event as CustomEvent<Element>).detail;
    });
    const link = [...selectionListRoot(editor).querySelectorAll('.dataset-row')]
      .find(item => item.querySelector('.dataset-name')?.textContent === 'rp2')
      ?.querySelector('button.dataset-connected');
    if (!(link instanceof HTMLElement)) throw new Error('data set link missing');
    link.click();
    expect(opened?.getAttribute('name')).toBe('datSet');
    expect(editor.selectCtrlBlock).toBeUndefined();
  });

  it('keeps searchValue on the Report list when passed as a prop', async () => {
    editor.remove();
    const el = await mountLit('report-control-editor', ReportControlEditor, {
      doc,
      searchValue: 'Report1',
    });
    expect(el.selectionList).toBeTruthy();
    expect(el.selectionList.searchValue).toBe('Report1');
    el.remove();
  });
});

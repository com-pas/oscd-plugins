import { afterEach, beforeEach, expect, it } from 'vitest';

import {
  isInsert,
  isRemove,
  isUpdate,
} from '@openenergytools/scl-lib/dist/foundation/utils.js';

import { smvControlDoc } from './smvControl.testfiles.js';
import { SampledValueControlEditor } from './sampled-value-control-editor.js';
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

const doc = new DOMParser().parseFromString(smvControlDoc, 'application/xml');

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

describeLitEditor('SampledValueControl editor component', () => {
  let editor: SampledValueControlEditor;
  let edits: ReturnType<typeof listenEvent>;

  beforeEach(async () => {
    editor = await mountLit(
      'sampled-value-control-editor',
      SampledValueControlEditor,
      { doc },
    );
    edits = listenEvent('oscd-edit-v2');
  });

  afterEach(() => {
    edits.stop();
    editor.remove();
  });

  it('allows to insert a new SampledValueControl when the IED has one LDevice', async () => {
    clickSelection(editor, '.ied-add');
    expect(edits.handler).not.toHaveBeenCalled();
    await clickCreateAdd(editor, 'sampled-value-control-edit-dialog', '.smv.save');
    expect(edits.handler).toHaveBeenCalledOnce();
    const insert = (lastDetail(edits.handler).edit as { parent: Element; node: Element }[])[0];
    expect(isInsert(insert)).toBe(true);
    expect(insert.parent.tagName).toBe('LN0');
    expect(insert.node.tagName).toBe('SampledValueControl');
  });

  it('adds a Sampled Value on the selected LDevice when the IED has several', async () => {
    const copyDoc = doc.cloneNode(true) as XMLDocument;
    const server = copyDoc.querySelector('IED[name="IED"] > AccessPoint > Server');
    if (!server) throw new Error('missing server');
    server.append(lDevice(copyDoc, 'plain'), lDevice(copyDoc, 'chosen', true));
    editor.remove();
    editor = await mountLit('sampled-value-control-editor', SampledValueControlEditor, {
      doc: copyDoc,
    });

    clickSelection(editor, '.ied-add');
    await editor.updateComplete;
    expect(edits.handler).not.toHaveBeenCalled();

    const dialog = editor.lDeviceSelectDialog.shadowRoot!;
    const blocked = lDeviceChoice(dialog, 'plain');
    expect(blocked.querySelector('md-radio')?.hasAttribute('disabled')).toBe(true);
    expect(blocked.getAttribute('title')).toBe('This LDevice has no LN0.');

    (lDeviceChoice(dialog, 'chosen').querySelector('md-radio') as HTMLElement).click();
    await editor.updateComplete;
    (dialog.querySelector('md-filled-button.ldevice.select') as HTMLElement).click();
    await editor.updateComplete;
    expect(edits.handler).not.toHaveBeenCalled();

    await clickCreateAdd(editor, 'sampled-value-control-edit-dialog', '.smv.save');
    const created = lastDetail(edits.handler).edit as { parent: Element; node: Element }[];
    const control = created.find(insert => insert.node.tagName === 'SampledValueControl');
    expect(control?.parent.closest('LDevice')?.getAttribute('inst')).toBe('chosen');
    const address = created.find(insert => insert.node.tagName === 'SMV');
    expect(address?.node.getAttribute('ldInst')).toBe('chosen');
  });

  it('allows to remove and existing SampledValueControl element', async () => {
    clickSelection(editor, '.dataset-delete');
    expect(edits.handler).toHaveBeenCalledOnce();
    const remove = (lastDetail(edits.handler).edit as { node: Element }[])[0];
    expect(isRemove(remove)).toBe(true);
    expect(remove.node.tagName).toBe('SampledValueControl');
  });

  it('allows to insert new DataSet and link with existing SampledValueControl', async () => {
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

  it('edits a Sampled Value from the list and leaves the detail closed', async () => {
    const root = selectionListRoot(editor);
    const smv2 = [...root.querySelectorAll('.dataset-row')].find(
      row => row.querySelector('.dataset-name')?.textContent === 'smv2',
    );
    const labels = [...(smv2?.querySelectorAll('.dataset-actions button') ?? [])].map(
      button => button.getAttribute('aria-label'),
    );
    expect(labels).toEqual([
      'Edit Sampled Value',
      'Copy Sampled Value',
      'Remove Sampled Value',
    ]);

    (smv2?.querySelector('.dataset-edit') as HTMLElement).click();
    await editor.updateComplete;
    expect(editor.selectCtrlBlock).toBeUndefined();
    expect(editor.shadowRoot?.querySelector('.elementeditorcontainer')).toBeNull();
    expect(editor.shadowRoot?.querySelector('sampled-value-control-element-editor')).toBeNull();
    const dialog = editor.shadowRoot?.querySelector('sampled-value-control-edit-dialog');
    expect(
      (dialog as { control?: Element } | null)?.control?.getAttribute('name'),
    ).toBe('smv2');
  });

  it('shows the Sampled Value columns and connects a data set without opening the detail', async () => {
    const root = selectionListRoot(editor);
    const header = [...(root.querySelector('.selection-header')?.children ?? [])].map(
      cell => cell.textContent,
    );
    expect(header).toEqual([
      'Name',
      'Connected Data Set',
      'confRev',
      'Sample mode',
      'smpRate',
      'nofASDU',
      'Security',
      'Sampled Value ID',
      '',
    ]);
    const headerCells = [...(root.querySelector('.selection-header')?.children ?? [])];
    expect(
      headerCells
        .filter(cell => !cell.classList.contains('narrow-hide'))
        .map(cell => cell.textContent),
    ).toEqual(['Name', 'Connected Data Set', '']);

    const row = (name: string) =>
      [...root.querySelectorAll('.dataset-row')].find(
        item => item.querySelector('.dataset-name')?.textContent === name,
      );

    const smv1 = row('smv1');
    const smv2 = row('smv2');
    const smv3 = row('smv3');
    expect(smv2?.querySelector('.dataset-path')).toBeNull();
    expect(smv2?.querySelector('button.dataset-connected')?.textContent).toBe('datSet');
    expect(
      [...(smv2?.children ?? [])].filter(cell => !cell.classList.contains('narrow-hide')),
    ).toHaveLength(3);
    expect(smv2?.querySelector('.conf-rev')?.textContent).toBe('43');
    expect(smv2?.querySelector('.smp-mod')?.textContent).toBe('SmpPerPeriod');
    expect(smv2?.querySelector('.smp-rate')?.textContent).toBe('80');
    expect(smv2?.querySelector('.nof-asdu')?.textContent).toBe('1');
    expect(smv2?.querySelector('.security')?.textContent).toBe('-');
    expect(smv2?.querySelector('.smv-id')?.textContent).toBe('someSmvID');

    expect(smv1?.querySelector('.connect-dataset')).toBeTruthy();
    expect(smv1?.querySelector('.conf-rev')?.textContent).toBe('-');
    expect(smv1?.querySelector('.smp-mod')?.textContent).toBe('SmpPerSec');
    expect(smv1?.querySelector('.smp-rate')?.textContent).toBe('4000');
    expect(smv1?.querySelector('.nof-asdu')?.textContent).toBe('1');
    expect(smv1?.querySelector('.security')?.textContent).toBe('Signature only');
    expect(smv1?.querySelector('.smv-id')?.textContent).toBe('');

    expect(smv3?.querySelector('.connect-dataset')).toBeTruthy();
    expect(smv3?.querySelector('.conf-rev')?.textContent).toBe('-');
    expect(smv3?.querySelector('.smp-mod')?.textContent).toBe('SecPerSmp');
    expect(smv3?.querySelector('.security')?.textContent).toBe('-');

    (smv1?.querySelector('.connect-dataset') as HTMLElement).click();
    await editor.updateComplete;
    expect(editor.selectCtrlBlock).toBeUndefined();
    expect(editor.shadowRoot?.querySelector('.elementeditorcontainer')).toBeNull();

    const dialogItems = actionItems(editor, 'md-dialog.dialog.select action-list');
    dialogItems.find(item => item.headline === 'datSet')?.primaryAction?.();
    expect(edits.handler).toHaveBeenCalledOnce();
    const update = lastDetail(edits.handler).edit as {
      element: Element;
      attributes: { datSet: string };
    };
    expect(isUpdate(update)).toBe(true);
    expect(update.element.getAttribute('name')).toBe('smv1');
    expect(update.attributes.datSet).toBe('datSet');
  });

  it('allows to change an existing DataSet', async () => {
    clickSelection(editor, '.dataset-row');
    await editor.updateComplete;
    editor.changeDataSet.click();
    await editor.updateComplete;
    actionItems(editor, 'md-dialog.dialog.select action-list')
      .find((item) => item.headline === 'datSet2')
      ?.primaryAction?.();
    expect(edits.handler).toHaveBeenCalledOnce();
    const update = lastDetail(edits.handler).edit as {
      element: Element;
      attributes: { datSet: string };
    };
    expect(isUpdate(update)).toBe(true);
    expect(update.element.tagName).toBe('SampledValueControl');
    expect(update.attributes.datSet).toBe('datSet2');
  });

  it('closes the detail when the selected sampled value is clicked again', async () => {
    const row = () =>
      [...selectionListRoot(editor).querySelectorAll('.dataset-row')].find(
        item => item.querySelector('.dataset-name')?.textContent === 'smv2',
      ) as HTMLElement;
    row().click();
    await editor.updateComplete;
    expect(editor.selectCtrlBlock?.getAttribute('name')).toBe('smv2');
    row().click();
    await editor.updateComplete;
    expect(editor.selectCtrlBlock).toBeUndefined();
    expect(editor.shadowRoot?.querySelector('.elementeditorcontainer')).toBeNull();
  });

  it('keeps searchValue on the Sampled Value list when passed as a prop', async () => {
    editor.remove();
    const el = await mountLit(
      'sampled-value-control-editor',
      SampledValueControlEditor,
      { doc, searchValue: 'SV1' },
    );
    expect(el.selectionList).toBeTruthy();
    expect(el.selectionList.searchValue).toBe('SV1');
    el.remove();
  });
});

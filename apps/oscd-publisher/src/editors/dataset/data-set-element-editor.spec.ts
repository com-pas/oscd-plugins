import { afterEach, beforeEach, expect, it } from 'vitest';

import { isInsert, isRemove } from '@openenergytools/scl-lib/dist/foundation/utils.js';

import { dataSetDoc } from './data-set-editor.testfiles.js';
import { DataSetEditDialog } from './data-set-edit-dialog.js';
import { DataSetElementEditor } from './data-set-element-editor.js';
import {
  describeLitEditor,
  lastDetail,
  listenEvent,
  mountLit,
} from '../../test/lit-fixture.js';

const doc = new DOMParser().parseFromString(dataSetDoc, 'application/xml');
const dataSet = doc.querySelector('LDevice[inst="ldInst1"] DataSet')!;

type CheckBox = HTMLElement & { checked: boolean };

function editDialog(editor: DataSetElementEditor): DataSetEditDialog {
  const dialog = editor.shadowRoot?.querySelector('data-set-edit-dialog');
  if (!(dialog instanceof DataSetEditDialog)) {
    throw new Error('data-set-edit-dialog missing');
  }
  return dialog;
}

describeLitEditor('DataSet element editor', () => {
  let editor: DataSetElementEditor;
  let edits: ReturnType<typeof listenEvent>;

  beforeEach(async () => {
    editor = await mountLit('data-set-element-editor', DataSetElementEditor, {
      element: dataSet,
    });
    edits = listenEvent('oscd-edit-v2');
  });

  afterEach(() => {
    edits.stop();
    editor.remove();
  });

  it('allows to change DataSets name attribute', async () => {
    const dialog = editDialog(editor);
    dialog.inputs[0].value = 'SomeDataSetName';
    dialog.onInputChange();
    await dialog.updateComplete;
    dialog.saveButton.click();
    expect(editor.element).toBe(dataSet);
    expect(edits.handler).toHaveBeenCalledOnce();
    expect(
      (lastDetail(edits.handler).edit as { attributes: { name: string } }[])[0]
        .attributes.name,
    ).toBe('SomeDataSetName');
  });

  it('allows to change DataSets desc attribute', async () => {
    const dialog = editDialog(editor);
    await dialog.updateComplete;
    const desc = dialog.inputs[1];
    expect(desc.value).toBeNull();
    (desc.shadowRoot!.querySelector('.lock') as HTMLButtonElement).click();
    desc.value = 'SomeNewDesc';
    expect(desc.value).toBe('SomeNewDesc');
    dialog.onInputChange();
    await dialog.updateComplete;
    dialog.saveButton.click();
    expect(edits.handler).toHaveBeenCalledOnce();
    expect(
      (lastDetail(edits.handler).edit as { attributes: { desc: string } }[])[0]
        .attributes.desc,
    ).toBe('SomeNewDesc');
  });

  it('allows to remove DataSets child data', () => {
    (editor.shadowRoot!.querySelector('.entry-delete') as HTMLButtonElement).click();
    expect(edits.handler).toHaveBeenCalledOnce();
    const remove = (lastDetail(edits.handler).edit as { node: Element }[])[0];
    expect(remove.node.tagName).toBe('FCDA');
  });

  function dragEntry(from: number, to: number): void {
    const rows = [...editor.shadowRoot!.querySelectorAll('.entry-row')];
    rows[from]
      .querySelector('.drag-handle')!
      .dispatchEvent(new Event('dragstart'));
    rows[to].dispatchEvent(new Event('drop'));
  }

  it('allows to move FCDA child one step up', () => {
    const toBeMovedFCDA = dataSet.querySelectorAll(':scope > FCDA')[1];
    const reference = toBeMovedFCDA.previousElementSibling;
    dragEntry(1, 0);
    expect(edits.handler).toHaveBeenCalledOnce();
    const editList = lastDetail(edits.handler).edit as unknown[];
    expect(editList).toHaveLength(2);
    expect(isRemove(editList[0])).toBe(true);
    expect((editList[0] as { node: Element }).node).toBe(toBeMovedFCDA);
    expect(isInsert(editList[1])).toBe(true);
    expect((editList[1] as { parent: Element }).parent).toBe(dataSet);
    expect((editList[1] as { node: Element }).node).toBe(toBeMovedFCDA);
    expect((editList[1] as { reference: Element | null }).reference).toBe(
      reference,
    );
  });

  it('moves a filtered row to after the last visible entry', async () => {
    const fcdas = [...dataSet.querySelectorAll(':scope > FCDA')];
    const dragged = fcdas[6];
    const afterLastVisible = fcdas[9];
    const search = editor.shadowRoot!.querySelector(
      '.entry-search input',
    ) as HTMLInputElement;
    search.value = 'phsA';
    search.dispatchEvent(new Event('input'));
    await editor.updateComplete;

    const rows = [...editor.shadowRoot!.querySelectorAll('.entry-row')];
    expect(rows).toHaveLength(3);
    const end = () =>
      editor.shadowRoot!.querySelector('.entry-drop-end') as HTMLElement;
    rows[0]
      .querySelector('.drag-handle')!
      .dispatchEvent(new Event('dragstart'));
    end().dispatchEvent(new Event('dragover'));
    await editor.updateComplete;
    expect(end().classList.contains('drop-end')).toBe(true);
    editor.requestUpdate();
    await editor.updateComplete;
    expect(end().classList.contains('drop-end')).toBe(true);
    end().dispatchEvent(new Event('drop'));

    expect(edits.handler).toHaveBeenCalledOnce();
    const editList = lastDetail(edits.handler).edit as unknown[];
    expect(editList).toHaveLength(2);
    expect(isRemove(editList[0])).toBe(true);
    expect((editList[0] as { node: Element }).node).toBe(dragged);
    expect(isInsert(editList[1])).toBe(true);
    expect((editList[1] as { parent: Element }).parent).toBe(dataSet);
    expect((editList[1] as { node: Element }).node).toBe(dragged);
    expect((editList[1] as { reference: Element | null }).reference).toBe(
      afterLastVisible,
    );
  });

  it('allows to move FCDA child one step down', () => {
    const toBeMovedFCDA = dataSet.querySelectorAll(':scope > FCDA')[1];
    const reference = toBeMovedFCDA.nextElementSibling?.nextElementSibling;
    dragEntry(1, 3);
    expect(edits.handler).toHaveBeenCalledOnce();
    const editList = lastDetail(edits.handler).edit as unknown[];
    expect(editList).toHaveLength(2);
    expect(isRemove(editList[0])).toBe(true);
    expect((editList[0] as { node: Element }).node).toBe(toBeMovedFCDA);
    expect(isInsert(editList[1])).toBe(true);
    expect((editList[1] as { parent: Element }).parent).toBe(dataSet);
    expect((editList[1] as { node: Element }).node).toBe(toBeMovedFCDA);
    expect((editList[1] as { reference: Element | null }).reference).toBe(
      reference,
    );
  });

  it('deletes only selected rows that the filter shows', async () => {
    const fcdas = [...dataSet.querySelectorAll(':scope > FCDA')];
    const hidden = fcdas[0];
    const visible = fcdas[9];
    const rows = () => [...editor.shadowRoot!.querySelectorAll('.entry-row')];

    const hiddenBox = rows()[0].querySelector('md-checkbox') as CheckBox;
    hiddenBox.checked = true;
    hiddenBox.dispatchEvent(new Event('change'));
    await editor.updateComplete;

    const search = editor.shadowRoot!.querySelector(
      '.entry-search input',
    ) as HTMLInputElement;
    search.value = 'phsB';
    search.dispatchEvent(new Event('input'));
    await editor.updateComplete;
    expect(rows()).toHaveLength(1);

    const visibleBox = rows()[0].querySelector('md-checkbox') as CheckBox;
    visibleBox.checked = true;
    visibleBox.dispatchEvent(new Event('change'));
    await editor.updateComplete;

    (
      editor.shadowRoot!.querySelector('.delete-selected') as HTMLButtonElement
    ).click();

    const edit = lastDetail(edits.handler).edit as { node: Element }[];
    expect(edit.map(action => action.node)).toEqual([visible]);
    expect(edit.some(action => action.node === hidden)).toBe(false);
  });

  it('allows adds new data attribute to DataSet', () => {
    editor.daPicker.paths = [
      [
        'LDevice: IED>>ldInst1',
        'LN: IED>>ldInst1>prefix MMXU 1',
        'DO: #MMXU>PhV',
        'SDO: #WYE>phsA',
        'DA: #CMV>cVal',
        'BDA: #Vector>mag',
        'BDA: #AnalogueValue>f',
      ],
      [
        'LDevice: IED>>ldInst1',
        'LN: IED>>ldInst1>prefix MMXU 1',
        'DO: #MMXU>PhV',
        'SDO: #WYE>phRes',
        'SDO: #CustomWYE>phsA',
        'DA: #CMV>cVal',
        'BDA: #Vector>mag',
        'BDA: #AnalogueValue>f',
      ],
    ];
    editor.daPickerSaveButton.click();
    expect(edits.handler).toHaveBeenCalledOnce();
    const inserts = lastDetail(edits.handler).edit as { node: Element }[];
    expect(inserts).toHaveLength(2);
    expect(isInsert(inserts[0])).toBe(true);
    expect(inserts[0].node.getAttribute('ldInst')).toBe('ldInst1');
    expect(inserts[0].node.getAttribute('prefix')).toBe('prefix');
    expect(inserts[0].node.getAttribute('lnClass')).toBe('MMXU');
    expect(inserts[0].node.getAttribute('lnInst')).toBe('1');
    expect(inserts[0].node.getAttribute('doName')).toBe('PhV.phsA');
    expect(inserts[0].node.getAttribute('daName')).toBe('cVal.mag.f');
    expect(inserts[0].node.getAttribute('fc')).toBe('MX');
    expect(isInsert(inserts[1])).toBe(true);
    expect(inserts[1].node.getAttribute('doName')).toBe('PhV.phRes.phsA');
    expect(inserts[1].node.getAttribute('daName')).toBe('cVal.mag.f');
  });

  it('allows adds new data object to DataSet', () => {
    editor.doPicker.paths = [
      [
        'LDevice: IED>>ldInst1',
        'LN: IED>>ldInst1>prefix MMXU 1',
        'DO: #MMXU>PhV',
        'SDO: #WYE>phsA',
        'FC: MX',
      ],
      [
        'LDevice: IED>>ldInst1',
        'LN: IED>>ldInst1>prefix MMXU 1',
        'DO: #MMXU>PhV',
        'SDO: #WYE>phRes',
        'SDO: #CustomWYE>phsA',
        'FC: MX',
      ],
    ];
    editor.doPickerSaveButton.click();
    expect(edits.handler).toHaveBeenCalledOnce();
    const inserts = lastDetail(edits.handler).edit as { node: Element }[];
    expect(inserts).toHaveLength(2);
    expect(isInsert(inserts[0])).toBe(true);
    expect(inserts[0].node.getAttribute('doName')).toBe('PhV.phsA');
    expect(inserts[0].node.getAttribute('daName')).toBeNull();
    expect(inserts[0].node.getAttribute('fc')).toBe('MX');
    expect(inserts[1].node.getAttribute('doName')).toBe('PhV.phRes.phsA');
    expect(inserts[1].node.getAttribute('daName')).toBeNull();
  });
});

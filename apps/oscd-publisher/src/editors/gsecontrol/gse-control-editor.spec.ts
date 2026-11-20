import { afterEach, beforeEach, expect, it } from 'vitest';

import {
  isInsert,
  isRemove,
  isUpdate,
} from '@openenergytools/scl-lib/dist/foundation/utils.js';

import {
  gseControlDoc,
  gseControlDocWithoutServices,
  gseControlWithMaxGSEControl,
} from './gseControl.testfiles.js';
import { gooseAddBlock } from '../add-block.js';
import { GseControlEditor } from './gse-control-editor.js';
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

const doc = new DOMParser().parseFromString(gseControlDoc, 'application/xml');

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

describeLitEditor('GSEControl editor component', () => {
  let editor: GseControlEditor;
  let edits: ReturnType<typeof listenEvent>;

  beforeEach(async () => {
    editor = await mountLit('gse-control-editor', GseControlEditor, { doc });
    edits = listenEvent('oscd-edit-v2');
  });

  afterEach(() => {
    edits.stop();
    editor.remove();
  });

  it('opens a collapsed IED group after adding a GOOSE', async () => {
    const group = selectionListRoot(editor).querySelector('.ied-group')!;
    (group.querySelector('.ied-chevron') as HTMLElement).click();
    await editor.updateComplete;
    expect(group.querySelector('.ied-toggle')?.getAttribute('aria-expanded')).toBe('false');

    (group.querySelector('.ied-add') as HTMLElement).click();
    await editor.updateComplete;
    expect(edits.handler).not.toHaveBeenCalled();
    await clickCreateAdd(editor, 'gse-control-edit-dialog', '.gse.save');

    const open = selectionListRoot(editor).querySelector('.ied-group')!;
    expect(open.querySelector('.ied-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(open.querySelector('.dataset-rows')).toBeTruthy();
    expect(edits.handler).toHaveBeenCalledOnce();
  });

  it('allows to insert new GSEControl element', async () => {
    clickSelection(editor, '.ied-add');
    expect(edits.handler).not.toHaveBeenCalled();
    await clickCreateAdd(editor, 'gse-control-edit-dialog', '.gse.save');
    expect(edits.handler).toHaveBeenCalledOnce();
    const insert = (lastDetail(edits.handler).edit as { parent: Element; node: Element }[])[0];
    expect(isInsert(insert)).toBe(true);
    expect(insert.parent.tagName).toBe('LN0');
    expect(insert.node.tagName).toBe('GSEControl');
  });

  it('adds a GOOSE on the selected LDevice when the IED has several', async () => {
    const copyDoc = doc.cloneNode(true) as XMLDocument;
    const server = copyDoc.querySelector('IED[name="IED"] > AccessPoint > Server');
    if (!server) throw new Error('missing server');
    server.append(lDevice(copyDoc, 'plain'), lDevice(copyDoc, 'chosen', true));
    editor.remove();
    editor = await mountLit('gse-control-editor', GseControlEditor, { doc: copyDoc });

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

    await clickCreateAdd(editor, 'gse-control-edit-dialog', '.gse.save');
    const created = lastDetail(edits.handler).edit as { parent: Element; node: Element }[];
    const control = created.find(insert => insert.node.tagName === 'GSEControl');
    expect(control?.parent.closest('LDevice')?.getAttribute('inst')).toBe('chosen');
    const address = created.find(insert => insert.node.tagName === 'GSE');
    expect(address?.node.getAttribute('ldInst')).toBe('chosen');
  });

  it('allows to remove and existing GSEControl element', async () => {
    clickSelection(editor, '.dataset-delete');
    expect(edits.handler).toHaveBeenCalledOnce();
    const remove = (lastDetail(edits.handler).edit as { node: Element }[])[0];
    expect(isRemove(remove)).toBe(true);
    expect(remove.node.tagName).toBe('GSEControl');
  });

  it('allows to insert new DataSet and link with existing GSEControl', async () => {
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

  it('allows to change an existing DataSet', async () => {
    clickSelection(editor, '.dataset-row');
    await editor.updateComplete;
    editor.changeDataSet.click();
    await editor.updateComplete;
    const dialogItems = actionItems(editor, 'md-dialog.dialog.select action-list');
    const datSet2 = dialogItems.find((item) => item.headline === 'datSet2');
    datSet2?.primaryAction?.();
    expect(edits.handler).toHaveBeenCalledOnce();
    const update = lastDetail(edits.handler).edit as {
      element: Element;
      attributes: { datSet: string };
    };
    expect(isUpdate(update)).toBe(true);
    expect(update.element.tagName).toBe('GSEControl');
    expect(update.attributes.datSet).toBe('datSet2');
  });

  it('shows the saved data set in the open detail', async () => {
    const root = selectionListRoot(editor);
    const gse2 = [...root.querySelectorAll('.dataset-row')].find(
      item => item.querySelector('.dataset-name')?.textContent === 'gse2',
    );
    (gse2 as HTMLElement).click();
    await editor.updateComplete;

    const datasetEditor = () =>
      editor.shadowRoot?.querySelector('data-set-element-editor') as
        | (HTMLElement & { element: Element | null })
        | null;
    expect(datasetEditor()?.element?.getAttribute('name')).toBe('datSet');

    editor.selectCtrlBlock?.setAttribute('datSet', 'datSet2');
    editor.editCount += 1;
    await editor.updateComplete;
    await editor.updateComplete;

    expect(datasetEditor()?.element?.getAttribute('name')).toBe('datSet2');
    expect(datasetEditor()?.shadowRoot?.querySelector('.detail-name')?.textContent).toBe(
      'datSet2',
    );
  });

  it('edits a GOOSE from the list and leaves the dataset pencil for the DataSet dialog', async () => {
    const root = selectionListRoot(editor);
    const gse2 = [...root.querySelectorAll('.dataset-row')].find(
      item => item.querySelector('.dataset-name')?.textContent === 'gse2',
    );
    const labels = [...(gse2?.querySelectorAll('.dataset-actions button') ?? [])].map(
      button => button.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['Edit GSEControl', 'Copy GOOSE', 'Remove GOOSE']);

    (gse2?.querySelector('.dataset-edit') as HTMLElement).click();
    await editor.updateComplete;
    expect(editor.selectCtrlBlock).toBeUndefined();
    expect(editor.shadowRoot?.querySelector('.elementeditorcontainer')).toBeNull();
    const gooseDialog = editor.shadowRoot?.querySelector('gse-control-edit-dialog');
    expect(gooseDialog?.getAttribute('slot')).toBeNull();
    expect(
      (gooseDialog as { control?: Element } | null)?.control?.getAttribute('name'),
    ).toBe('gse2');

    (gse2 as HTMLElement).click();
    await editor.updateComplete;
    const datasetEditor = editor.shadowRoot?.querySelector('data-set-element-editor');
    expect(
      datasetEditor?.shadowRoot?.querySelector('[aria-label="Edit DataSet"]'),
    ).toBeTruthy();
    expect(
      datasetEditor?.shadowRoot?.querySelector('[aria-label="Edit GSEControl"]'),
    ).toBeNull();
    expect(
      datasetEditor?.shadowRoot?.querySelector('data-set-edit-dialog'),
    ).toBeTruthy();

    const gse1 = [...root.querySelectorAll('.dataset-row')].find(
      item => item.querySelector('.dataset-name')?.textContent === 'gse1',
    );
    (gse1?.querySelector('.dataset-edit') as HTMLElement).click();
    await editor.updateComplete;
    expect(editor.selectCtrlBlock?.getAttribute('name')).toBe('gse2');
    expect(editor.shadowRoot?.querySelector('.elementeditorcontainer')).toBeTruthy();
    expect(
      (editor.shadowRoot?.querySelector('gse-control-edit-dialog') as {
        control?: Element;
      } | null)?.control?.getAttribute('name'),
    ).toBe('gse1');
  });

  it('shows the GOOSE columns and connects a data set without opening the detail', async () => {
    editor.remove();
    const local = new DOMParser().parseFromString(gseControlDoc, 'application/xml');
    const stored = local.querySelector(
      'IED[name="IED"] GSEControl[name="gse2"]',
    )!;
    stored.setAttribute('confRev', '10001');
    stored.setAttribute('securityEnabled', 'SignatureAndEncryption');
    stored.setAttribute('fixedOffs', 'false');
    editor = await mountLit('gse-control-editor', GseControlEditor, {
      doc: local,
    });

    const root = selectionListRoot(editor);
    const header = root.querySelector('.selection-header')?.textContent ?? '';
    expect(header).toContain('Name');
    expect(header).toContain('Connected Data Set');
    expect(header).toContain('confRev');
    expect(header).toContain('Type');
    expect(header).toContain('Security');
    expect(header).toContain('Fixed Offset');
    const headerCells = [
      ...(root.querySelector('.selection-header')?.children ?? []),
    ];
    expect(headerCells.at(-1)?.textContent).toBe('');
    expect(
      headerCells
        .filter(cell => !cell.classList.contains('narrow-hide'))
        .map(cell => cell.textContent),
    ).toEqual(['Name', 'Connected Data Set', '']);

    const row = (name: string) =>
      [...root.querySelectorAll('.dataset-row')].find(
        item => item.querySelector('.dataset-name')?.textContent === name,
      );

    const gse1 = row('gse1');
    const gse2 = row('gse2');
    expect(gse1?.querySelector('.connect-dataset')).toBeTruthy();
    expect(gse1?.querySelector('.conf-rev')?.textContent).toBe('-');
    expect(gse1?.querySelector('.type')?.textContent).toBe('GSSE');
    expect(gse1?.querySelector('.security')?.textContent).toBe('Signature only');
    expect(gse1?.querySelector('.fixed-offset')?.textContent).toBe('True');
    expect(gse1?.querySelector('.dataset-path')).toBeNull();

    expect(gse2?.querySelector('button.dataset-connected')?.textContent).toBe('datSet');
    expect(
      [...(gse2?.children ?? [])].filter(cell => !cell.classList.contains('narrow-hide')),
    ).toHaveLength(3);
    expect(gse2?.querySelector('.connect-dataset')).toBeNull();
    expect(gse2?.querySelector('.conf-rev')?.textContent).toBe('10001');
    expect(gse2?.querySelector('.type')?.textContent).toBe('GOOSE');
    expect(gse2?.querySelector('.security')?.textContent).toBe(
      'Signature & encryption',
    );
    expect(gse2?.querySelector('.fixed-offset')?.textContent).toBe('False');

    const gse3 = row('gse3');
    expect(gse3?.querySelector('.conf-rev')?.textContent).toBe('-');
    expect(gse3?.querySelector('.security')?.textContent).toBe('-');
    expect(gse3?.querySelector('.fixed-offset')?.textContent).toBe('-');
    expect(gse3?.querySelector('.type')?.textContent).toBe('GOOSE');

    (gse1?.querySelector('.connect-dataset') as HTMLElement).click();
    await editor.updateComplete;
    expect(editor.selectCtrlBlock).toBeUndefined();
    expect(editor.shadowRoot?.querySelector('.elementeditorcontainer')).toBeNull();
    expect(editor.selectionList?.classList.contains('hidden')).toBe(false);

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
    expect(update.element.getAttribute('name')).toBe('gse1');
    expect(update.attributes.datSet).toBe('datSet');
  });

  it('keeps searchValue on the GOOSE list when passed as a prop', async () => {
    editor.remove();
    const el = await mountLit('gse-control-editor', GseControlEditor, {
      doc,
      searchValue: 'GSE1',
    });
    expect(el.selectionList).toBeTruthy();
    expect(el.selectionList?.searchValue).toBe('GSE1');
    el.remove();
  });

  describe('with missing <Services><GOOSE> element', () => {
    let docWithoutServices: Document;

    beforeEach(async () => {
      docWithoutServices = new DOMParser().parseFromString(
        gseControlDocWithoutServices,
        'application/xml',
      );
      editor.remove();
      editor = await mountLit('gse-control-editor', GseControlEditor, {
        doc: docWithoutServices,
      });
    });

    it('disables Add when Services > GOOSE is missing', () => {
      const button = selectionListRoot(editor).querySelector('.ied-add') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('title')).toBe('Services > GOOSE is missing.');
      const logs = listenEvent('log');
      button.click();
      expect(logs.handler).not.toHaveBeenCalled();
      logs.stop();
    });

    it('disables Add when the IED has no LN0', () => {
      const buttons = [
        ...selectionListRoot(editor).querySelectorAll('.ied-add'),
      ] as HTMLButtonElement[];
      expect(gooseAddBlock(docWithoutServices.querySelector('IED[name="IED_No_LN0"]')!)).toBe(
        'This IED has no LN0.',
      );
      expect(buttons[1]?.disabled).toBe(true);
      expect(buttons[1]?.getAttribute('title')).toBe('This IED has no LN0.');
    });
  });

  it('disconnects a data set from the list and from the detail', async () => {
    const row = (name: string) =>
      [...selectionListRoot(editor).querySelectorAll('.dataset-row')].find(
        item => item.querySelector('.dataset-name')?.textContent === name,
      );
    const gse1 = row('gse1');
    const gse2 = row('gse2');
    expect(gse1?.querySelector('.dataset-disconnect')).toBeNull();
    const listButton = gse2?.querySelector('.dataset-disconnect');
    expect(listButton).toBeTruthy();
    expect(gse2?.querySelector('.dataset-actions .dataset-disconnect')).toBeNull();
    expect(listButton?.querySelector('md-icon')?.textContent).toBe('link_off');
    (listButton as HTMLElement).click();
    expect(editor.selectCtrlBlock).toBeUndefined();
    const listEdit = lastDetail(edits.handler).edit as {
      element: Element;
      attributes: { datSet: string | null };
    };
    expect(isUpdate(listEdit)).toBe(true);
    expect(listEdit.element.getAttribute('name')).toBe('gse2');
    expect(listEdit.attributes.datSet).toBeNull();
    expect(doc.querySelector('DataSet[name="datSet"]')).toBeTruthy();

    (gse2 as HTMLElement).click();
    await editor.updateComplete;
    const detailButton = editor.shadowRoot?.querySelector(
      'data-set-element-editor [aria-label="Disconnect DataSet"]',
    );
    expect(detailButton).toBeTruthy();
    (detailButton as HTMLElement).click();
    const detailEdit = lastDetail(edits.handler).edit as {
      element: Element;
      attributes: { datSet: null };
    };
    expect(detailEdit.element.getAttribute('name')).toBe('gse2');
    expect(detailEdit.attributes.datSet).toBeNull();
  });

  it('closes the detail when the selected GOOSE is clicked again', async () => {
    const row = () =>
      [...selectionListRoot(editor).querySelectorAll('.dataset-row')].find(
        item => item.querySelector('.dataset-name')?.textContent === 'gse2',
      ) as HTMLElement;
    row().click();
    await editor.updateComplete;
    expect(editor.selectCtrlBlock?.getAttribute('name')).toBe('gse2');
    row().click();
    await editor.updateComplete;
    expect(editor.selectCtrlBlock).toBeUndefined();
    expect(editor.shadowRoot?.querySelector('.elementeditorcontainer')).toBeNull();
  });

  it('opens the linked data set without opening the GOOSE detail', async () => {
    let opened: Element | undefined;
    editor.addEventListener('open-dataset', event => {
      opened = (event as CustomEvent<Element>).detail;
    });
    const link = [...selectionListRoot(editor).querySelectorAll('.dataset-row')]
      .find(item => item.querySelector('.dataset-name')?.textContent === 'gse2')
      ?.querySelector('button.dataset-connected');
    if (!(link instanceof HTMLElement)) throw new Error('data set link missing');
    link.click();
    expect(opened?.getAttribute('name')).toBe('datSet');
    expect(editor.selectCtrlBlock).toBeUndefined();
  });

  describe('with maximum GSEControl elements', () => {
    it('creates a message that the maximum number of GSEControl elements has been reached', () => {
      const docWithMaxGSEControl = new DOMParser().parseFromString(
        gseControlWithMaxGSEControl,
        'application/xml',
      );
      const ied = docWithMaxGSEControl.querySelector(
        'IED[name="IED_Max_GSEControl_Reached"]',
      )!;
      expect(gooseAddBlock(ied)).toBe(
        'The maximum number of GOOSE controls (1) has been reached.',
      );
    });
  });
});

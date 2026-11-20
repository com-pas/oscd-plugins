import { afterEach, beforeEach, expect, it } from 'vitest';

import {
  isInsert,
  isRemove,
  isUpdate,
} from '@openenergytools/scl-lib/dist/foundation/utils.js';

import { reportControlDoc } from './reportControl.testfiles.js';
import { ReportControlEditDialog } from './report-control-edit-dialog.js';
import {
  describeLitEditor,
  lastDetail,
  listenEvent,
  mountLit,
} from '../../test/lit-fixture.js';

type Field = HTMLElement & {
  value: string | null;
  disabled?: boolean;
  updateComplete: Promise<unknown>;
};

type SaveButton = HTMLElement & { disabled: boolean };

type EditAction = {
  element?: Element;
  attributes?: Record<string, string | null>;
};

function field(dialog: ReportControlEditDialog, selector: string): Field {
  const node = dialog.shadowRoot?.querySelector(selector);
  if (!(node instanceof HTMLElement)) throw new Error(`${selector} missing`);
  return node as Field;
}

function saveButton(dialog: ReportControlEditDialog): SaveButton {
  const button = dialog.shadowRoot?.querySelector('.report.save');
  if (!(button instanceof HTMLElement)) throw new Error('save missing');
  return button as SaveButton;
}

function setValue(node: Field, value: string | null): void {
  node.value = value;
  node.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}

function clearLock(node: Field): void {
  const button = node.shadowRoot?.querySelector('button.lock');
  if (!(button instanceof HTMLElement)) throw new Error('lock missing');
  button.click();
}

describeLitEditor('ReportControl edit dialog', () => {
  let dialog: ReportControlEditDialog;
  let edits: ReturnType<typeof listenEvent>;

  beforeEach(() => {
    edits = listenEvent('oscd-edit-v2');
  });

  afterEach(() => {
    edits?.stop();
    dialog?.remove();
  });

  async function mount(controlName: string): Promise<Element> {
    const doc = new DOMParser().parseFromString(reportControlDoc, 'application/xml');
    const control = doc.querySelector(`ReportControl[name="${controlName}"]`)!;
    const dataSetName = control.getAttribute('datSet');
    const dataSet = dataSetName
      ? control.parentElement?.querySelector(`DataSet[name="${dataSetName}"]`) ?? null
      : null;
    dialog = await mountLit(
      'report-control-edit-dialog',
      ReportControlEditDialog,
      { control, dataSet },
    );
    await dialog.show();
    return control;
  }

  it('shows the data set read-only and writes the link on save', async () => {
    const control = await mount('rp2');
    const name = field(dialog, '.dataset.name');
    const desc = field(dialog, '.dataset.desc');
    expect(name.value).toBe('datSet');
    expect(desc.disabled).toBe(true);
    expect(desc.shadowRoot?.querySelector('button.lock')).toBeNull();
    expect(field(dialog, '.control.buffered').shadowRoot?.querySelector('button.lock')).toBeNull();

    const next = control.ownerDocument.querySelector('DataSet[name="datSet2"]');
    if (!next) throw new Error('datSet2 missing');
    dialog.stageDataSet(next);
    await dialog.updateComplete;
    expect(field(dialog, '.dataset.name').value).toBe('datSet2');
    expect(saveButton(dialog).disabled).toBe(false);

    saveButton(dialog).click();
    const actions = lastDetail(edits.handler).edit as EditAction[];
    expect(actions).toEqual([{ element: control, attributes: { datSet: 'datSet2' } }]);
  });

  it('writes a description change with the raised configuration revision', async () => {
    const control = await mount('rp2');
    field(dialog, '.control.desc').value = 'renamed report';
    field(dialog, '.control.desc').dispatchEvent(
      new Event('input', { bubbles: true, composed: true }),
    );
    await dialog.updateComplete;
    expect(saveButton(dialog).disabled).toBe(false);

    saveButton(dialog).click();
    const actions = lastDetail(edits.handler).edit as EditAction[];
    expect(actions[0]?.element).toBe(control);
    expect(actions[0]?.attributes?.desc).toBe('renamed report');
    expect(actions[0]?.attributes?.confRev).toBe('10053');
    expect(actions.some(action => action.attributes?.datSet)).toBe(false);
  });

  it('writes report attributes and removes an empty client limit', async () => {
    const control = await mount('rp2');
    setValue(field(dialog, '.control.name'), 'SomeNewName');
    clearLock(field(dialog, '.control.desc'));
    setValue(field(dialog, '.control.conf-rev'), '40001');
    setValue(field(dialog, '.control.buffered'), 'false');
    setValue(field(dialog, '.control.rpt-id'), 'someOtherID');
    clearLock(field(dialog, '.control.indexed'));
    clearLock(field(dialog, '.control.max'));
    setValue(field(dialog, '.control.intg-pd'), '43');
    await dialog.updateComplete;

    saveButton(dialog).click();
    const editList = lastDetail(edits.handler).edit as unknown[];
    expect(editList).toHaveLength(2);
    const update = editList[0] as EditAction;
    expect(update.element).toBe(control);
    expect(update.attributes).toEqual({
      name: 'SomeNewName',
      desc: null,
      confRev: '10053',
      rptID: 'someOtherID',
      buffered: 'false',
      indexed: null,
      intgPd: '43',
    });
    expect(isRemove(editList[1])).toBe(true);
    expect((editList[1] as { node: Element }).node.tagName).toBe('RptEnabled');
  });

  it('writes changed optional fields', async () => {
    await mount('rp2');
    setValue(field(dialog, 'publisher-checkbox.opt[data-attr="seqNum"]'), 'false');
    setValue(field(dialog, 'publisher-checkbox.opt[data-attr="timeStamp"]'), 'false');
    clearLock(field(dialog, 'publisher-checkbox.opt[data-attr="dataSet"]'));
    clearLock(field(dialog, 'publisher-checkbox.opt[data-attr="reasonCode"]'));
    setValue(field(dialog, 'publisher-checkbox.opt[data-attr="dataRef"]'), 'false');
    setValue(field(dialog, 'publisher-checkbox.opt[data-attr="entryID"]'), 'false');
    clearLock(field(dialog, 'publisher-checkbox.opt[data-attr="configRef"]'));
    await dialog.updateComplete;

    saveButton(dialog).click();
    const actions = lastDetail(edits.handler).edit as EditAction[];
    expect(actions).toHaveLength(1);
    expect(isUpdate(actions[0])).toBe(true);
    expect(actions[0]?.element?.tagName).toBe('OptFields');
    expect(actions[0]?.attributes).toEqual({
      seqNum: 'false',
      timeStamp: 'false',
      reasonCode: null,
      entryID: 'false',
      dataSet: null,
      dataRef: 'false',
      configRef: null,
    });
  });

  it('writes changed trigger options', async () => {
    await mount('rp2');
    setValue(field(dialog, 'publisher-checkbox.trg[data-attr="dchg"]'), 'false');
    clearLock(field(dialog, 'publisher-checkbox.trg[data-attr="qchg"]'));
    setValue(field(dialog, 'publisher-checkbox.trg[data-attr="dupd"]'), 'false');
    setValue(field(dialog, 'publisher-checkbox.trg[data-attr="period"]'), 'false');
    clearLock(field(dialog, 'publisher-checkbox.trg[data-attr="gi"]'));
    await dialog.updateComplete;

    saveButton(dialog).click();
    const actions = lastDetail(edits.handler).edit as EditAction[];
    expect(actions).toHaveLength(1);
    expect(isUpdate(actions[0])).toBe(true);
    expect(actions[0]?.element?.tagName).toBe('TrgOps');
    expect(actions[0]?.attributes).toEqual({
      dchg: 'false',
      qchg: null,
      dupd: 'false',
      period: 'false',
      gi: null,
    });
  });

  it('creates TrgOps with only the opened options', async () => {
    const control = await mount('rp3');
    setValue(field(dialog, 'publisher-checkbox.trg[data-attr="qchg"]'), 'true');
    setValue(field(dialog, 'publisher-checkbox.trg[data-attr="dupd"]'), 'true');
    await dialog.updateComplete;

    saveButton(dialog).click();
    const actions = lastDetail(edits.handler).edit as {
      parent: Element;
      node: Element;
    }[];
    expect(actions).toHaveLength(1);
    expect(isInsert(actions[0])).toBe(true);
    expect(actions[0]?.parent.tagName).toBe('ReportControl');
    expect(actions[0]?.parent).toBe(control);
    expect(actions[0]?.node.tagName).toBe('TrgOps');
    expect(actions[0]?.node.hasAttribute('qchg')).toBe(true);
    expect(actions[0]?.node.hasAttribute('dupd')).toBe(true);
  });

  it('creates OptFields with only the opened fields', async () => {
    const control = await mount('rp3');
    setValue(field(dialog, 'publisher-checkbox.opt[data-attr="timeStamp"]'), 'true');
    setValue(field(dialog, 'publisher-checkbox.opt[data-attr="dataSet"]'), 'true');
    await dialog.updateComplete;

    saveButton(dialog).click();
    const actions = lastDetail(edits.handler).edit as {
      parent: Element;
      node: Element;
    }[];
    expect(actions).toHaveLength(1);
    expect(isInsert(actions[0])).toBe(true);
    expect(actions[0]?.parent).toBe(control);
    expect(actions[0]?.node.tagName).toBe('OptFields');
    expect(actions[0]?.node.hasAttribute('timeStamp')).toBe(true);
    expect(actions[0]?.node.hasAttribute('dataSet')).toBe(true);
  });

  it('inserts TrgOps before an existing OptFields', async () => {
    const control = await mount('rp4');
    setValue(field(dialog, 'publisher-checkbox.trg[data-attr="qchg"]'), 'true');
    setValue(field(dialog, 'publisher-checkbox.trg[data-attr="dupd"]'), 'true');
    await dialog.updateComplete;

    saveButton(dialog).click();
    const actions = lastDetail(edits.handler).edit as {
      parent: Element;
      reference: Element;
    }[];
    expect(actions).toHaveLength(1);
    expect(isInsert(actions[0])).toBe(true);
    expect(actions[0]?.parent).toBe(control);
    expect(actions[0]?.reference.tagName).toBe('OptFields');
  });
});

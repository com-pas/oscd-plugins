import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { gseControlDoc } from './gseControl.testfiles.js';
import { GseControlEditDialog } from './gse-control-edit-dialog.js';
import {
  describeLitEditor,
  lastDetail,
  listenEvent,
  mountLit,
} from '../../test/lit-fixture.js';

type Field = HTMLElement & {
  value: string | null;
  updateComplete: Promise<unknown>;
};

type SaveButton = HTMLElement & { disabled: boolean };

type EditAction = {
  element?: Element;
  attributes?: Record<string, string | null>;
  node?: Node;
};

function field(dialog: GseControlEditDialog, selector: string): Field {
  const node = dialog.shadowRoot?.querySelector(selector);
  if (!(node instanceof HTMLElement)) throw new Error(`${selector} missing`);
  return node as Field;
}

function clickLock(host: HTMLElement): void {
  const button = host.shadowRoot?.querySelector('button.lock');
  if (!(button instanceof HTMLElement)) throw new Error('lock missing');
  button.click();
}

function saveButton(dialog: GseControlEditDialog): SaveButton {
  const button = dialog.shadowRoot?.querySelector('.gse.save');
  if (!(button instanceof HTMLElement)) throw new Error('save missing');
  return button as SaveButton;
}

async function commit(dialog: GseControlEditDialog): Promise<void> {
  const fields = Array.from(
    dialog.shadowRoot!.querySelectorAll(
      'publisher-text-field, publisher-radio, publisher-select, publisher-checkbox'
    )
  ) as Field[];
  await Promise.all(fields.map(item => item.updateComplete));
  field(dialog, '.control.name').dispatchEvent(
    new Event('input', { bubbles: true, composed: true })
  );
  await dialog.updateComplete;
}

describeLitEditor('GSEControl edit dialog', () => {
  let dialog: GseControlEditDialog;
  let edits: ReturnType<typeof listenEvent>;

  beforeEach(() => {
    edits = listenEvent('oscd-edit-v2');
  });

  afterEach(() => {
    edits?.stop();
    dialog?.remove();
  });

  async function mount(
    controlName: string,
    withDataSet: boolean
  ): Promise<Element> {
    const doc = new DOMParser().parseFromString(gseControlDoc, 'application/xml');
    const control = doc.querySelector(`GSEControl[name="${controlName}"]`)!;
    const dataSet = withDataSet
      ? doc.querySelector('DataSet[name="datSet"]')
      : null;
    dialog = await mountLit('gse-control-edit-dialog', GseControlEditDialog, {
      control,
      dataSet,
    });
    await dialog.show();
    return control;
  }

  it('writes changed GSEControl attributes in one edit', async () => {
    const control = await mount('gse2', true);
    expect(saveButton(dialog).disabled).toBe(true);

    field(dialog, '.control.name').value = 'SomeNewName';
    field(dialog, '.control.desc').value = 'SomeNewDesc';
    field(dialog, '.control.type').value = 'GSSE';
    field(dialog, '.control.conf-rev').value = '10001';
    field(dialog, '.control.app-id').value = 'someNewAppID';
    clickLock(field(dialog, '.control.fixed-offs'));
    field(dialog, '.control.security').value = 'None';
    await commit(dialog);

    expect(saveButton(dialog).disabled).toBe(false);
    saveButton(dialog).click();

    expect(edits.handler).toHaveBeenCalledOnce();
    const actions = lastDetail(edits.handler).edit as EditAction[];
    expect(actions[0]?.element).toBe(control);
    expect(actions[0]?.attributes).toEqual({
      name: 'SomeNewName',
      desc: 'SomeNewDesc',
      confRev: '10001',
      appID: 'someNewAppID',
      type: 'GSSE',
      fixedOffs: 'false',
      securityEnabled: 'None',
    });
    expect(lastDetail(edits.handler).title).toContain('Update GSEControl');
  });

  it('writes communication changes into the GSE address and times', async () => {
    await mount('gse2', true);
    field(dialog, '.gse.mac').value = '01-0C-CD-01-00-13';
    field(dialog, '.gse.app-id').value = '1234';
    clickLock(field(dialog, '.gse.vlan-id'));
    clickLock(field(dialog, '.gse.vlan-priority'));
    field(dialog, '.gse.min-time').value = '76';
    field(dialog, '.gse.max-time').value = '465';
    await commit(dialog);

    expect(saveButton(dialog).disabled).toBe(false);
    saveButton(dialog).click();

    expect(edits.handler).toHaveBeenCalledOnce();
    const actions = lastDetail(edits.handler).edit as EditAction[];
    const created = actions
      .map(action => action.node)
      .filter((node): node is Element => node instanceof Element);
    const address = created.find(node => node.tagName === 'Address');
    expect(address?.querySelector('P[type="MAC-Address"]')?.textContent).toBe(
      '01-0C-CD-01-00-13'
    );
    expect(address?.querySelector('P[type="APPID"]')?.textContent).toBe('1234');
    expect(address?.querySelector('P[type="VLAN-ID"]')).toBeNull();
    expect(address?.querySelector('P[type="VLAN-PRIORITY"]')).toBeNull();
    expect(created.find(node => node.tagName === 'MinTime')?.textContent).toBe(
      '76'
    );
    expect(created.find(node => node.tagName === 'MaxTime')?.textContent).toBe(
      '465'
    );
  });

  it('updates the title from the name after typing pauses', async () => {
    await mount('gse2', true);
    const title = () =>
      dialog.shadowRoot
        ?.querySelector('publisher-edit-dialog')
        ?.shadowRoot?.querySelector('.headline-name')?.textContent;
    expect(title()).toBe('gse2');

    vi.useFakeTimers();
    try {
      const name = field(dialog, '.control.name');
      name.value = 'gse2x';
      name.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await dialog.updateComplete;
      expect(title()).toBe('gse2');

      name.value = 'gse2xy';
      name.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await vi.advanceTimersByTimeAsync(199);
      await dialog.updateComplete;
      expect(title()).toBe('gse2');

      await vi.advanceTimersByTimeAsync(1);
      await dialog.updateComplete;
      expect(title()).toBe('gse2xy');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the data set read-only and writes the link on save', async () => {
    const control = await mount('gse2', true);
    const name = field(dialog, '.dataset.name');
    const desc = field(dialog, '.dataset.desc');
    expect(name.value).toBe('datSet');
    expect((desc as { disabled?: boolean }).disabled).toBe(true);
    expect(desc.shadowRoot?.querySelector('button.lock')).toBeNull();

    const next = control.ownerDocument.querySelector('DataSet[name="datSet2"]')!;
    dialog.stageDataSet(next);
    await dialog.updateComplete;
    expect(field(dialog, '.dataset.name').value).toBe('datSet2');
    expect(field(dialog, '.dataset.desc').value).toBe(next.getAttribute('desc') ?? '');
    expect(saveButton(dialog).disabled).toBe(false);

    saveButton(dialog).click();
    expect(edits.handler).toHaveBeenCalledOnce();
    const actions = lastDetail(edits.handler).edit as EditAction[];
    expect(actions).toEqual([{ element: control, attributes: { datSet: 'datSet2' } }]);
    expect(actions.some(action => action.element?.tagName === 'DataSet')).toBe(false);
  });

  it('drops a staged data set when the document is reloaded', async () => {
    const control = await mount('gse2', true);
    const next = control.ownerDocument.querySelector('DataSet[name="datSet2"]')!;
    dialog.stageDataSet(next);
    await dialog.updateComplete;
    expect(field(dialog, '.dataset.name').value).toBe('datSet2');

    dialog.editCount += 1;
    await dialog.updateComplete;
    await dialog.updateComplete;
    expect(field(dialog, '.dataset.name').value).toBe('datSet');
    expect(edits.handler).not.toHaveBeenCalled();
  });

  it('shows the saved data set after editCount while the property stays old', async () => {
    const control = await mount('gse2', true);
    const next = control.ownerDocument.querySelector('DataSet[name="datSet2"]')!;
    dialog.stageDataSet(next);
    await dialog.updateComplete;

    control.setAttribute('datSet', 'datSet2');
    dialog.editCount += 1;
    await dialog.updateComplete;
    await dialog.updateComplete;

    expect(dialog.dataSet?.getAttribute('name')).toBe('datSet');
    expect(field(dialog, '.dataset.name').value).toBe('datSet2');
    expect(edits.handler).not.toHaveBeenCalled();
  });

  it('asks the page to change the data set without saving', async () => {
    await mount('gse2', true);
    const changes = listenEvent('change-dataset');
    const button = dialog.shadowRoot?.querySelector('.change.dataset');
    if (!(button instanceof HTMLElement)) throw new Error('change missing');
    button.click();

    expect(changes.handler).toHaveBeenCalledOnce();
    expect(edits.handler).not.toHaveBeenCalled();
    changes.stop();
  });

  it('does not write a DataSet when none is connected', async () => {
    const control = await mount('gse3', false);
    expect(dialog.shadowRoot?.querySelector('.dataset.desc')).toBeNull();
    expect(dialog.shadowRoot?.querySelector('.dataset.name')).toBeTruthy();

    field(dialog, '.control.name').value = 'gse3renamed';
    await commit(dialog);
    saveButton(dialog).click();

    const actions = lastDetail(edits.handler).edit as EditAction[];
    expect(actions.some(action => action.element === control)).toBe(true);
    expect(
      actions.some(
        action =>
          action.element?.tagName === 'DataSet' ||
          (action.node instanceof Element && action.node.tagName === 'DataSet')
      )
    ).toBe(false);
  });
});

import { afterEach, beforeEach, expect, it } from 'vitest';

import { isUpdate } from '@openenergytools/scl-lib/dist/foundation/utils.js';

import { smvControlDoc } from './smvControl.testfiles.js';
import { SampledValueControlEditDialog } from './sampled-value-control-edit-dialog.js';
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
};

function field(dialog: SampledValueControlEditDialog, selector: string): Field {
  const node = dialog.shadowRoot?.querySelector(selector);
  if (!(node instanceof HTMLElement)) throw new Error(`${selector} missing`);
  return node as Field;
}

function saveButton(dialog: SampledValueControlEditDialog): SaveButton {
  const button = dialog.shadowRoot?.querySelector('.smv.save');
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

describeLitEditor('SampledValueControl edit dialog', () => {
  let dialog: SampledValueControlEditDialog;
  let edits: ReturnType<typeof listenEvent>;
  let smvControl: Element;

  beforeEach(async () => {
    const control = new DOMParser()
      .parseFromString(smvControlDoc, 'application/xml')
      .querySelector('SampledValueControl[name="smv2"]');
    if (!control) throw new Error('smv2 missing');
    smvControl = control;
    dialog = await mountLit(
      'sampled-value-control-edit-dialog',
      SampledValueControlEditDialog,
      { control: smvControl },
    );
    await dialog.show();
    edits = listenEvent('oscd-edit-v2');
  });

  afterEach(() => {
    edits.stop();
    dialog.remove();
  });

  it('allows to change the SampledValueControl elements attributes', async () => {
    setValue(field(dialog, '.control.name'), 'SomeNewName');
    clearLock(field(dialog, '.control.desc'));
    setValue(field(dialog, '.control.conf-rev'), '40001');
    setValue(field(dialog, '.control.smv-id'), 'someOtherSmvID');
    setValue(field(dialog, '.control.sample-mode'), 'SmpPerSec');
    setValue(field(dialog, '.control.smp-rate'), '4000');
    setValue(field(dialog, '.control.nof-asdu'), '2');
    setValue(field(dialog, '.control.security'), 'None');
    await dialog.updateComplete;

    saveButton(dialog).click();

    expect(edits.handler).toHaveBeenCalledOnce();
    const update = (lastDetail(edits.handler).edit as unknown[])[0] as EditAction;
    expect(update.element).toBe(smvControl);
    expect(update.attributes).toEqual({
      name: 'SomeNewName',
      desc: null,
      confRev: '40001',
      smvID: 'someOtherSmvID',
      smpMod: 'SmpPerSec',
      smpRate: '4000',
      nofASDU: '2',
      securityEnabled: 'None',
    });
  });

  it('allows to change the SMV element child element', async () => {
    setValue(field(dialog, '.comm.mac'), '01-0C-CD-04-00-13');
    setValue(field(dialog, '.comm.app-id'), '1234');
    clearLock(field(dialog, '.comm.vlan-id'));
    clearLock(field(dialog, '.comm.vlan-priority'));
    await dialog.updateComplete;

    saveButton(dialog).click();

    expect(edits.handler).toHaveBeenCalledOnce();
    expect((lastDetail(edits.handler).edit as unknown[]).length).toBe(2);
  });

  it('allows to change the SmvOpts element child element', async () => {
    clearLock(field(dialog, '.opt.refresh-time'));
    setValue(field(dialog, '.opt.sample-synchronized'), 'false');
    clearLock(field(dialog, '.opt.sample-rate'));
    clearLock(field(dialog, '.opt.data-set'));
    setValue(field(dialog, '.opt.security'), 'false');
    setValue(field(dialog, '.opt.timestamp'), 'false');
    setValue(field(dialog, '.opt.synch-source'), 'false');
    await dialog.updateComplete;

    saveButton(dialog).click();

    expect(edits.handler).toHaveBeenCalledOnce();
    const update = (lastDetail(edits.handler).edit as EditAction[])[0];
    expect(isUpdate(update)).toBe(true);
    expect(update?.element?.tagName).toBe('SmvOpts');
    expect(update?.attributes).toEqual({
      refreshTime: null,
      sampleSynchronized: 'false',
      sampleRate: null,
      dataSet: null,
      security: 'false',
      timestamp: 'false',
      synchSourceId: 'false',
    });
  });
});

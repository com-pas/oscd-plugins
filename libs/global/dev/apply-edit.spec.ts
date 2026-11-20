import { describe, expect, it } from 'vitest';
import { applyOscdEdit } from './apply-edit';

function parse(xml: string): XMLDocument {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

describe('applyOscdEdit', () => {
  it('removes a node from a batch and still applies a later attribute edit', () => {
    const doc = parse(
      `<SCL><DataSet name="ds1"/><GSEControl name="g1" datSet="ds1" confRev="1"/></SCL>`,
    );
    const dataSet = doc.querySelector('DataSet')!;
    const control = doc.querySelector('GSEControl')!;

    applyOscdEdit([
      { node: dataSet },
      { element: control, attributes: { datSet: null, confRev: '10001' } },
    ]);

    expect(doc.querySelector('DataSet')).toBeNull();
    expect(control.hasAttribute('datSet')).toBe(false);
    expect(control.getAttribute('confRev')).toBe('10001');
    expect(control.getAttribute('name')).toBe('g1');
  });

  it('sets attributes without clearing child elements', () => {
    const doc = parse(`<DataSet name="old"><FCDA ldInst="LD0"/></DataSet>`);
    const dataSet = doc.documentElement;

    applyOscdEdit({ element: dataSet, attributes: { name: 'new' } });

    expect(dataSet.getAttribute('name')).toBe('new');
    expect(dataSet.querySelector('FCDA')?.getAttribute('ldInst')).toBe('LD0');
  });

  it('replaces text content', () => {
    const doc = parse(`<Private type="t">old</Private>`);

    applyOscdEdit({ element: doc.documentElement, textContent: 'new' });

    expect(doc.documentElement.textContent).toBe('new');
    expect(doc.documentElement.getAttribute('type')).toBe('t');
  });

  it('inserts a node', () => {
    const doc = parse(`<SCL><Header/></SCL>`);
    const created = doc.createElement('IED');
    created.setAttribute('name', 'A');

    applyOscdEdit({
      parent: doc.documentElement,
      node: created,
      reference: null,
    });

    expect(doc.documentElement.lastElementChild).toBe(created);
  });

  it('reorders siblings with a remove followed by an insert', () => {
    const doc = parse(`<DataSet><FCDA name="a"/><FCDA name="b"/></DataSet>`);
    const [first, second] = [...doc.documentElement.children];

    applyOscdEdit([
      { node: first },
      { parent: doc.documentElement, node: first, reference: null },
    ]);

    expect([...doc.documentElement.children]).toEqual([second, first]);
  });
});

import { describe, expect, it } from 'vitest';

import { dataSetNameTaken } from './data-set-name.js';

describe('dataSetNameTaken', () => {
  const doc = new DOMParser().parseFromString(
    '<LN0><DataSet name="datSet"/><DataSet name="datSet2"/></LN0>',
    'application/xml',
  );
  const parent = doc.documentElement;
  const own = parent.children[1];

  it('rejects a name another DataSet under the same parent already uses', () => {
    expect(dataSetNameTaken(parent, 'datSet', own)).toBe(true);
  });

  it('allows the name of the DataSet being edited', () => {
    expect(dataSetNameTaken(parent, 'datSet2', own)).toBe(false);
  });

  it('does not treat an empty name as taken', () => {
    expect(dataSetNameTaken(parent, '', own)).toBe(false);
  });
});

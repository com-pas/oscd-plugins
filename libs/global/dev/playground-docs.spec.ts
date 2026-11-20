import { describe, expect, it } from 'vitest';
import {
  LARGE_PLAYGROUND_DOC,
  PLAYGROUND_DOCS,
  assertPlaygroundDocOptions,
  listUnknownPlaygroundDocs,
  parsePlaygroundDocument,
} from './playground-docs';

describe('playground docs', () => {
  it('lists unknown names once, in input order', () => {
    expect(
      listUnknownPlaygroundDocs([
        'missing-a.scd',
        'sample-ieds.scd',
        'missing-a.scd',
        'missing-b.scd',
      ]),
    ).toEqual(['missing-a.scd', 'missing-b.scd']);
  });

  it('rejects unknown relevantDocs and defaultDoc in one message', () => {
    expect(() =>
      assertPlaygroundDocOptions({
        relevantDocs: ['sample-ieds.scd', 'nope.scd'],
        defaultDoc: 'also-missing.scd',
      }),
    ).toThrow(
      'Unknown playground document(s): nope.scd, also-missing.scd. ' +
        `Available: ${Object.keys(PLAYGROUND_DOCS).join(', ')}`,
    );
  });

  it('rejects a defaultDoc that is not in relevantDocs', () => {
    expect(() =>
      assertPlaygroundDocOptions({
        relevantDocs: ['sample-ieds.scd'],
        defaultDoc: 'new-project-1.scd',
      }),
    ).toThrow(
      'defaultDoc "new-project-1.scd" is not listed in relevantDocs (sample-ieds.scd)',
    );
  });

  it('accepts a known subset', () => {
    expect(() =>
      assertPlaygroundDocOptions({
        relevantDocs: ['sample-ieds.scd', 'new-project-1.scd'],
        defaultDoc: 'sample-ieds.scd',
      }),
    ).not.toThrow();
  });

  it('keeps the large SCL as a fetch URL and does not parse it here', () => {
    const entry = PLAYGROUND_DOCS[LARGE_PLAYGROUND_DOC];
    expect(entry.kind).toBe('url');
    if (entry.kind !== 'url') return;
    expect(entry.url).toContain(LARGE_PLAYGROUND_DOC);
    expect(() => parsePlaygroundDocument(LARGE_PLAYGROUND_DOC)).toThrow(
      /loaded with fetch/,
    );
  });

  it('parses sample-ieds.scd into an SCL document', () => {
    const doc = parsePlaygroundDocument('sample-ieds.scd');
    expect(doc.documentElement.localName).toBe('SCL');
    expect(doc.querySelector('IED')?.getAttribute('name')).toBe('IED_A');
  });

  it('parses each publisher playground file as a single SCL', () => {
    const names = Object.keys(PLAYGROUND_DOCS).filter((name) =>
      name.startsWith('publisher-'),
    );
    expect(names).toEqual([
      'publisher-dataset_copy-test.scd',
      'publisher-goose.scd',
      'publisher-goose-2.scd',
      'publisher-goose-with-desc.scd',
      'publisher-goose-without-services.scd',
      'publisher-goose-max.scd',
      'publisher-report.scd',
      'publisher-report-2.scd',
      'publisher-report-with-desc.scd',
      'publisher-smv.scd',
      'publisher-smv-2.scd',
      'publisher-smv-with-desc.scd',
    ]);
    for (const name of names) {
      const doc = parsePlaygroundDocument(name);
      expect(doc.querySelector('parsererror'), name).toBeNull();
      expect(doc.documentElement.localName, name).toBe('SCL');
    }
  });

  it('gives every publisher IED room to add an FCDA', () => {
    const names = Object.keys(PLAYGROUND_DOCS).filter(
      (name) =>
        name.startsWith('publisher-') &&
        name !== 'publisher-goose-without-services.scd',
    );
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const doc = parsePlaygroundDocument(name);
      const ieds = [...doc.querySelectorAll('IED')];
      expect(ieds.length, name).toBeGreaterThan(0);
      for (const ied of ieds) {
        const maxAttributes = Number(
          ied.querySelector('ConfDataSet')?.getAttribute('maxAttributes'),
        );
        const fcdaCount = ied.querySelectorAll('FCDA').length;
        expect(
          maxAttributes,
          `${name} ${ied.getAttribute('name')}`,
        ).toBeGreaterThan(fcdaCount);
      }
    }
  });
});

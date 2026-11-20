import { describe, expect, it } from 'vitest';
import { formatXml } from './format-xml';

function parse(xml: string): XMLDocument {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

describe('formatXml', () => {
  it('indents nested elements and uses empty-element tags', () => {
    const doc = parse(
      `<SCL xmlns="http://www.iec.ch/61850/2003/SCL"><Header id="x"/><IED name="A"><LN/></IED></SCL>`,
    );
    expect(formatXml(doc)).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<SCL xmlns="http://www.iec.ch/61850/2003/SCL">',
        '  <Header id="x"/>',
        '  <IED name="A">',
        '    <LN/>',
        '  </IED>',
        '</SCL>',
        '',
      ].join('\n'),
    );
  });

  it('keeps a single text child on one line and escapes markup', () => {
    const doc = parse(`<Private type="t">a &amp; b &lt;c&gt;</Private>`);
    expect(formatXml(doc)).toContain(
      '<Private type="t">a &amp; b &lt;c&gt;</Private>',
    );
  });
});

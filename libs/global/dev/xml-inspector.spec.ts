import { describe, expect, it } from 'vitest';
import {
  XML_INSPECTOR_MAX_BYTES,
  isXmlSourceTooLarge,
  syncXmlInspector,
  isXmlInspectorBlocked,
  isXmlInspectorOpen,
} from './xml-inspector';

describe('xml inspector size gate', () => {
  it('keeps 100 kB as the default pretty-print limit', () => {
    expect(XML_INSPECTOR_MAX_BYTES).toBe(100 * 1024);
  });

  it('allows source at the limit and blocks one byte over', () => {
    expect(isXmlSourceTooLarge('a'.repeat(XML_INSPECTOR_MAX_BYTES))).toBe(
      false,
    );
    expect(isXmlSourceTooLarge('a'.repeat(XML_INSPECTOR_MAX_BYTES + 1))).toBe(
      true,
    );
  });

  it('blocks the inspector for oversized source and keeps it closed', () => {
    syncXmlInspector('a'.repeat(XML_INSPECTOR_MAX_BYTES + 1));
    expect(isXmlInspectorBlocked()).toBe(true);
    expect(isXmlInspectorOpen()).toBe(false);

    syncXmlInspector('<SCL/>');
    expect(isXmlInspectorBlocked()).toBe(false);
  });
});

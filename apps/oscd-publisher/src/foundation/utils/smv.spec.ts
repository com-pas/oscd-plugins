import { describe, expect, it } from 'vitest';

import {
  nulledSMV,
  partlyInstType,
  withInstType,
  woInstType,
} from './smv.testfiels.js';

import { checkSMVDiff } from './smv.js';

function findElement(str: string, selector: string): Element | null {
  return new DOMParser()
    .parseFromString(str, 'application/xml')
    .querySelector(selector);
}

const pTypeOff = {
  'MAC-Address': null,
  APPID: null,
  'VLAN-ID': null,
  'VLAN-PRIORITY': null,
};

const pTypeOn = {
  'MAC-Address': '01-0C-CD-04-00-03',
  APPID: '4004',
  'VLAN-ID': '000',
  'VLAN-PRIORITY': '4',
};

describe('Utility function for SMV element', () => {
  describe('checkSMVDiff', () => {
    it('indicates xsi:type discrepancy with missing xsi:type ', () =>
      expect(
        checkSMVDiff(findElement(woInstType, 'SMV')!, {
          pTypes: pTypeOn,
          instType: true,
        })
      ).toBe(true));

    it('indicates xsi:type fit with missing xsi:type ', () =>
      expect(
        checkSMVDiff(findElement(woInstType, 'SMV')!, {
          pTypes: pTypeOn,
          instType: false,
        })
      ).toBe(false));

    it('indicates xsi:type discrepancy with existing xsi:type', () =>
      expect(
        checkSMVDiff(findElement(withInstType, 'SMV')!, {
          pTypes: pTypeOn,
          instType: false,
        })
      ).toBe(true));

    it('indicates xsi:type fit with existing xsi:type', () =>
      expect(
        checkSMVDiff(findElement(withInstType, 'SMV')!, {
          pTypes: pTypeOn,
          instType: true,
        })
      ).toBe(false));

    it('ignores xsi:type check if instType is undefined', () => {
      expect(
        checkSMVDiff(findElement(withInstType, 'SMV')!, { pTypes: pTypeOn })
      ).toBe(false);

      expect(
        checkSMVDiff(findElement(woInstType, 'SMV')!, { pTypes: pTypeOn })
      ).toBe(false);
    });

    it('always returns true with partially xsi:type', () => {
      expect(
        checkSMVDiff(findElement(partlyInstType, 'SMV')!, {
          pTypes: pTypeOn,
          instType: false,
        })
      ).toBe(true);

      expect(
        checkSMVDiff(findElement(partlyInstType, 'SMV')!, {
          pTypes: pTypeOn,
          instType: true,
        })
      ).toBe(true);
    });

    it('return true with fitting missing pTypes', () =>
      expect(
        checkSMVDiff(findElement(nulledSMV, 'SMV')!, { pTypes: pTypeOff })
      ).toBe(false));

    it('default pType to null with missing pTypes', () =>
      expect(checkSMVDiff(findElement(nulledSMV, 'SMV')!)).toBe(false));

    it('checks instType in empty GSE', () => {
      expect(
        checkSMVDiff(findElement(nulledSMV, 'SMV')!, {
          pTypes: pTypeOff,
          instType: true,
        })
      ).toBe(false);

      expect(
        checkSMVDiff(findElement(nulledSMV, 'SMV')!, {
          pTypes: pTypeOff,
          instType: false,
        })
      ).toBe(false);
    });

    it('checks MAC-Address changes', () => {
      let pTypes: Record<string, string | null> = { ...pTypeOn };
      pTypes['MAC-Address'] = null;

      expect(
        checkSMVDiff(findElement(woInstType, 'SMV')!, { pTypes })
      ).toBe(true);

      pTypes = { ...pTypeOff };
      pTypes['MAC-Address'] = '01-0C-CD-01-00-03';

      expect(checkSMVDiff(findElement(nulledSMV, 'SMV')!, { pTypes })).toBe(
        true
      );
    });

    it('checks APPID changes', () => {
      let pTypes: Record<string, string | null> = { ...pTypeOn };
      pTypes.APPID = null;

      expect(
        checkSMVDiff(findElement(woInstType, 'SMV')!, { pTypes })
      ).toBe(true);

      pTypes = { ...pTypeOff };
      pTypes.APPID = '4067';

      expect(checkSMVDiff(findElement(nulledSMV, 'SMV')!, { pTypes })).toBe(
        true
      );
    });

    it('checks VLAN-ID changes', () => {
      let pTypes: Record<string, string | null> = { ...pTypeOn };
      pTypes['VLAN-ID'] = null;

      expect(
        checkSMVDiff(findElement(woInstType, 'SMV')!, { pTypes })
      ).toBe(true);

      pTypes = { ...pTypeOff };
      pTypes['VLAN-ID'] = '12';

      expect(checkSMVDiff(findElement(nulledSMV, 'SMV')!, { pTypes })).toBe(
        true
      );
    });

    it('checks VLAN-PRIORITY changes', () => {
      let pTypes: Record<string, string | null> = { ...pTypeOn };
      pTypes['VLAN-PRIORITY'] = null;

      expect(
        checkSMVDiff(findElement(woInstType, 'SMV')!, { pTypes })
      ).toBe(true);

      pTypes = { ...pTypeOff };
      pTypes['VLAN-PRIORITY'] = '3';

      expect(checkSMVDiff(findElement(nulledSMV, 'SMV')!, { pTypes })).toBe(
        true
      );
    });
  });
});

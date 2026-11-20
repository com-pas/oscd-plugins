import { describe, expect, it } from 'vitest';

import type { Insert, Update } from '@openenergytools/open-scd-core';
import { isInsert, isRemove, isUpdate } from '@openenergytools/open-scd-core';

import { updateMaxClients } from './foundation.js';

function findElement(str: string, selector: string): Element | null {
  return new DOMParser()
    .parseFromString(str, 'application/xml')
    .querySelector(selector);
}

const missingRptControl = `
<ReportControl name="someName">
    <TrgOps dchg="true" dupd="false" period="true"/>
    <OptFields seqNum="true" timeStamp="false" reasonCode="true" dataRef="false" configRef="true" bufOvfl="false"/>
</ReportControl>`;

const existingRptControl = `
<ReportControl name="someName">
    <RptEnabled max="6" /> 
</ReportControl>`;

describe('ReportControl related functions', () => {
  describe('update max attribute on RptEnable', () => {
    it('add missing RptEnabled', () => {
      const reportControl = findElement(missingRptControl, 'ReportControl')!;
      const action = updateMaxClients(reportControl, '4');
      expect(isInsert(action)).toBe(true);
      // eslint-disable-next-line no-unused-expressions
      expect((action as Insert).reference).toBeNull();
      expect(((action as Insert).node as Element).getAttribute('max')).toBe(
        '4'
      );
    });

    it('do not change missing RptEnabled', () => {
      const reportControl = findElement(missingRptControl, 'ReportControl')!;
      const action = updateMaxClients(reportControl, null);
      // eslint-disable-next-line no-unused-expressions
      expect(action).toBeNull();
    });

    it('removes existing RptEnabled', () => {
      const reportControl = findElement(existingRptControl, 'ReportControl')!;
      const action = updateMaxClients(reportControl, null);
      // eslint-disable-next-line no-unused-expressions
      expect(isRemove(action)).toBe(true);
    });

    it('updated existing RptEnabled', () => {
      const reportControl = findElement(existingRptControl, 'ReportControl')!;
      const action = updateMaxClients(reportControl, '34');
      // eslint-disable-next-line no-unused-expressions
      expect(isUpdate(action)).toBe(true);
      expect((action as Update).attributes).toEqual({ max: '34' });
    });
  });
});

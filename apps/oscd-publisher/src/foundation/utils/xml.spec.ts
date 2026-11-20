import { beforeEach, describe, expect, it } from 'vitest';
import { iedWithLDevice, copyControlDoc } from './xml.testfiles.js';
import {
  copyIncompatibilityTitle,
  fcdaCopyMismatch,
  isFCDACompatibleWithIED,
  queryDataTypeLeaf,
  queryLDevice,
  queryLN,
} from './xml.js';

function parseXml(str: string): Document {
  return new DOMParser().parseFromString(str, 'application/xml');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function findElement(str: string, selector: string): Element | null {
  return parseXml(str).querySelector(selector);
}

describe('Xml utility', () => {
  let doc: Document;

  beforeEach(() => {
    doc = parseXml(copyControlDoc);
  });

  describe('queryLDevice', () => {
    it('find LDevice in ied', () => {
      const ied = parseXml(iedWithLDevice).documentElement;
      const lDeviceInst = 'someLDInst';
      const lDevice = queryLDevice(ied, lDeviceInst);

      expect(lDevice).not.toBeNull();
      expect(lDevice?.getAttribute('inst')).toBe(lDeviceInst);
    });
  });

  describe('queryLN', () => {
    it('finds LN0', () => {
      const lDevice = doc.querySelector(
        'IED[name="ToBeCopied"] LDevice[inst="LD1"]'
      )!;

      const ln = queryLN(lDevice, 'LLN0', '', null);

      expect(ln).not.toBeNull();
      expect(ln?.getAttribute('id')).toBe('ToBeCopied_LN0');
    });

    it('find LN with inst and prefix', () => {
      const lDevice = doc.querySelector(
        'IED[name="ToBeCopied"] LDevice[inst="LD1"]'
      )!;

      const ln = queryLN(lDevice, 'CILO', '1', 'CBHost');

      expect(ln).not.toBeNull();
      expect(ln?.getAttribute('id')).toBe('ToBeCopied_CBHost1');
    });

    it('find LN with inst and missing prefix', () => {
      const lDevice = doc.querySelector(
        'IED[name="ToBeCopied"] LDevice[inst="LD1"]'
      )!;

      const ln = queryLN(lDevice, 'MMXU', '1', '');

      expect(ln).not.toBeNull();
      expect(ln?.getAttribute('id')).toBe('ToBeCopied_MMXU');
    });
  });

  describe('queryDataTypeLeaf', () => {
    it('should fetch DO leaf', () => {
      const dataTypeTemplates = doc.querySelector('DataTypeTemplates')!;
      const lnType = 'CILO$oscd$_eb5ec6bb69650d07';

      const leaf = queryDataTypeLeaf(dataTypeTemplates, lnType, ['EnaOpn'], []);

      expect(leaf).not.toBeNull();
      expect(leaf?.tagName).toBe('DOType');
      expect(leaf?.getAttribute('id')).toBe('EnaOpn$oscd$_55462dcb3eb76dd6');
    });

    it('should return null if dataType is not found', () => {
      const dataTypeTemplates = doc.querySelector('DataTypeTemplates')!;
      const lnType = 'MMXU$oscd$_8046c36011040649';

      const leaf = queryDataTypeLeaf(
        dataTypeTemplates,
        lnType,
        ['A', 'phsA'],
        ['cVal', 'ang', 'f']
      );

      expect(leaf).toBeNull();
    });

    it('should fetch DA leaf', () => {
      const dataTypeTemplates = doc.querySelector('DataTypeTemplates')!;
      const lnType = 'MMXU$oscd$_bcec88edb16399a2';

      const leaf = queryDataTypeLeaf(
        dataTypeTemplates,
        lnType,
        ['A', 'phsA'],
        ['cVal', 'ang', 'f']
      );

      expect(leaf).not.toBeNull();
      expect(leaf?.tagName).toBe('DAType');
      expect(leaf?.getAttribute('id')).toBe('ang$oscd$_ed49c2f7a55ad05a');
    });
  });

  describe('isFCDACompatibleWithIED', () => {
    it('should return true for compatible FCDA', () => {
      const fcda = doc.querySelector(
        'IED[name="ToBeCopied"] LDevice[inst="LD1"] > LN0 > DataSet > FCDA'
      )!;
      const ied = doc.querySelector('IED[name="ToCopieTo8"]')!;

      const isCompatible = isFCDACompatibleWithIED(fcda, ied);
      expect(isCompatible).toBe(true);
    });

    it('should return false if IED is missing LDevice', () => {
      const fcda = doc.querySelector(
        'IED[name="ToBeCopied"] LDevice[inst="LD1"] > LN0 > DataSet > FCDA'
      )!;
      const ied = doc.querySelector('IED[name="ToCopieTo1"]')!;

      const isCompatible = isFCDACompatibleWithIED(fcda, ied);
      expect(isCompatible).toBe(false);
    });

    it('should return false if data type is incompatible', () => {
      const fcda = doc.querySelector(
        'IED[name="ToBeCopied"] LDevice[inst="LD1"] > LN0 > DataSet > FCDA'
      )!;
      const ied = doc.querySelector('IED[name="ToCopieTo4"]')!;

      const isCompatible = isFCDACompatibleWithIED(fcda, ied);
      expect(isCompatible).toBe(false);
    });
  });

  describe('LLN0 and functional constraint', () => {
    const lln0Doc = parseXml(`
      <SCL>
        <IED name="SRC">
          <AccessPoint><Server>
            <LDevice inst="ldInst1">
              <LN0 lnClass="LLN0" inst="" lnType="LLN0">
                <DataSet name="reviewLln0">
                  <FCDA ldInst="ldInst1" lnClass="LLN0" doName="Beh" daName="stVal" fc="ST" />
                  <FCDA ldInst="ldInst1" lnClass="LLN0" doName="Beh" daName="q" fc="MX" />
                  <FCDA ldInst="ldInst1" lnClass="LLN0" lnInst="" doName="Beh" fc="ST" />
                  <FCDA ldInst="ldInst1" lnClass="MMXU" lnInst="1" doName="PhV.phsA" daName="cVal.mag.f" fc="MX" />
                  <FCDA ldInst="ldInst1" lnClass="MMXU" lnInst="1" doName="PhV" fc="MX" />
                  <FCDA ldInst="ldInst1" lnClass="MMXU" lnInst="1" doName="PhV" fc="ST" />
                </DataSet>
              </LN0>
              <LN prefix="" lnClass="MMXU" inst="1" lnType="MMXU" />
            </LDevice>
          </Server></AccessPoint>
        </IED>
        <IED name="OK">
          <AccessPoint><Server>
            <LDevice inst="ldInst1">
              <LN0 lnClass="LLN0" inst="" lnType="LLN0" />
              <LN prefix="" lnClass="MMXU" inst="1" lnType="MMXU" />
            </LDevice>
          </Server></AccessPoint>
        </IED>
        <IED name="NoInst">
          <AccessPoint><Server>
            <LDevice inst="ldInst1">
              <LN0 lnClass="LLN0" lnType="LLN0" />
            </LDevice>
          </Server></AccessPoint>
        </IED>
        <IED name="WrongInst">
          <AccessPoint><Server>
            <LDevice inst="ldInst1">
              <LN0 lnClass="LLN0" inst="1" lnType="LLN0" />
            </LDevice>
          </Server></AccessPoint>
        </IED>
        <DataTypeTemplates>
          <LNodeType lnClass="LLN0" id="LLN0">
            <DO name="Beh" type="ENS" />
          </LNodeType>
          <LNodeType lnClass="MMXU" id="MMXU">
            <DO name="PhV" type="WYE" />
          </LNodeType>
          <DOType id="ENS" cdc="ENS">
            <DA name="stVal" fc="ST" bType="Enum" />
            <DA name="q" fc="ST" bType="Quality" />
          </DOType>
          <DOType id="WYE" cdc="WYE">
            <SDO name="phsA" type="CMV" />
          </DOType>
          <DOType id="CMV" cdc="CMV">
            <DA name="cVal" fc="MX" bType="Struct" type="Vector" />
          </DOType>
          <DAType id="Vector">
            <BDA name="mag" bType="Struct" type="AnalogueValue" />
          </DAType>
          <DAType id="AnalogueValue">
            <BDA name="f" bType="FLOAT32" />
          </DAType>
        </DataTypeTemplates>
      </SCL>
    `);

    const fcda = (index: number) =>
      lln0Doc.querySelectorAll('IED[name="SRC"] FCDA')[index];
    const ied = (name: string) => lln0Doc.querySelector(`IED[name="${name}"]`)!;

    it('accepts an LLN0 signal without lnInst when the target inst is empty', () => {
      expect(isFCDACompatibleWithIED(fcda(0), ied('OK'))).toBe(true);
      expect(fcdaCopyMismatch(fcda(0), ied('OK'))).toBeNull();
    });

    it('accepts an explicit empty lnInst on the FCDA', () => {
      expect(isFCDACompatibleWithIED(fcda(2), ied('OK'))).toBe(true);
    });

    it('rejects a target LN0 without inst or with a non-empty inst', () => {
      expect(queryLN(ied('NoInst').querySelector('LDevice')!, 'LLN0', '', null)).toBeNull();
      expect(fcdaCopyMismatch(fcda(0), ied('NoInst'))).toBe(
        'LN0 is not LLN0 or inst is not ""',
      );
      expect(fcdaCopyMismatch(fcda(0), ied('WrongInst'))).toBe(
        'LN0 is not LLN0 or inst is not ""',
      );
    });

    it('rejects a functional constraint that does not match the DA', () => {
      expect(fcdaCopyMismatch(fcda(1), ied('OK'))).toBe(
        'Functional constraint MX does not match',
      );
    });

    it('uses the DA fc for a BDA and any DA fc when daName is absent', () => {
      expect(isFCDACompatibleWithIED(fcda(3), ied('OK'))).toBe(true);
      expect(isFCDACompatibleWithIED(fcda(4), ied('OK'))).toBe(true);
      expect(fcdaCopyMismatch(fcda(5), ied('OK'))).toBe(
        'Functional constraint ST does not match',
      );
    });

    it('names the first failing signal and counts the rest', () => {
      const dataSet = lln0Doc.querySelector('DataSet[name="reviewLln0"]')!;
      const title = copyIncompatibilityTitle(
        ied('OK'),
        {
          ldInst: 'ldInst1',
          lnClass: 'LLN0',
          inst: '',
          prefix: null,
        },
        Array.from(dataSet.querySelectorAll('FCDA')),
      );
      expect(title).toBe(
        'ldInst1/LLN0.Beh.q: Functional constraint MX does not match. 1 more.',
      );
    });

    it('names a missing logical device when that is the first failure', () => {
      const title = copyIncompatibilityTitle(
        ied('OK'),
        { ldInst: 'other', lnClass: 'LLN0', inst: '', prefix: null },
        [fcda(0)],
      );
      expect(title).toBe('Logical device other is missing');
    });
  });
});

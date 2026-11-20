import { describe, expect, it } from 'vitest';

import {
  dataSetAddBlock,
  dataSetLDeviceBlock,
  gooseAddBlock,
  gooseLDeviceBlock,
  reportAddBlock,
  reportLDeviceBlock,
  reportUsage,
  smvAddBlock,
  smvLDeviceBlock,
} from './add-block.js';

function scl(xml: string): XMLDocument {
  return new DOMParser().parseFromString(`<SCL>${xml}</SCL>`, 'application/xml');
}

function iedNamed(xml: string, name = 'IED'): Element {
  const found = scl(xml).querySelector(`IED[name="${name}"]`);
  if (!found) throw new Error(`missing ${name}`);
  return found;
}

describe('data set add block', () => {
  it('names a missing LDevice', () => {
    expect(dataSetAddBlock(iedNamed('<IED name="IED"></IED>'))).toBe(
      'This IED has no LDevice.',
    );
  });

  it('names a missing LN0 and keeps an LN from enabling the plus', () => {
    const found = iedNamed(`
      <IED name="IED">
        <AccessPoint name="AP1">
          <Services><ConfDataSet max="5"/></Services>
          <Server><LDevice inst="ld1"><LN lnClass="MMXU" inst="1"/></LDevice></Server>
        </AccessPoint>
      </IED>`);
    expect(dataSetAddBlock(found)).toBe('This IED has no LN0.');
    expect(dataSetLDeviceBlock(found.querySelector('LDevice')!)).toBe(
      'This LDevice has no LN0.',
    );
  });

  it('names a missing ConfDataSet', () => {
    const found = iedNamed(`
      <IED name="IED">
        <AccessPoint name="AP1">
          <Server><LDevice inst="ld1"><LN0 lnClass="LLN0" inst=""/></LDevice></Server>
        </AccessPoint>
      </IED>`);
    expect(dataSetAddBlock(found)).toBe('Services > ConfDataSet is missing.');
    expect(dataSetLDeviceBlock(found.querySelector('LDevice')!)).toBe(
      'Services > ConfDataSet is missing.',
    );
  });

  it('names the DataSet maximum and leaves room open', () => {
    const full = iedNamed(`
      <IED name="IED">
        <AccessPoint name="AP1">
          <Services><ConfDataSet max="1"/></Services>
          <Server>
            <LDevice inst="ld1"><LN0 lnClass="LLN0" inst=""><DataSet name="ds1"/></LN0></LDevice>
          </Server>
        </AccessPoint>
      </IED>`);
    expect(dataSetAddBlock(full)).toBe(
      'The maximum number of DataSets (1) has been reached.',
    );

    const open = iedNamed(`
      <IED name="IED">
        <AccessPoint name="AP1">
          <Services><ConfDataSet max="2"/></Services>
          <Server>
            <LDevice inst="ld1"><LN0 lnClass="LLN0" inst=""><DataSet name="ds1"/></LN0></LDevice>
          </Server>
        </AccessPoint>
      </IED>`);
    expect(dataSetAddBlock(open)).toBeNull();
  });

  it('keeps the plus enabled when one LDevice can take a Data Set', () => {
    const found = iedNamed(`
      <IED name="IED">
        <AccessPoint name="AP1">
          <Services><ConfDataSet max="4"/></Services>
          <Server>
            <LDevice inst="empty"><LN lnClass="MMXU" inst="1"/></LDevice>
            <LDevice inst="ready"><LN0 lnClass="LLN0" inst=""/></LDevice>
          </Server>
        </AccessPoint>
      </IED>`);
    expect(dataSetAddBlock(found)).toBeNull();
    const devices = found.querySelectorAll('LDevice');
    expect(dataSetLDeviceBlock(devices[0])).toBe('This LDevice has no LN0.');
    expect(dataSetLDeviceBlock(devices[1])).toBeNull();
  });

  it('prefers a missing ConfDataSet over a reached maximum', () => {
    const found = iedNamed(`
      <IED name="IED">
        <AccessPoint name="open">
          <Server><LDevice inst="plain"><LN0 lnClass="LLN0" inst=""/></LDevice></Server>
        </AccessPoint>
        <AccessPoint name="full">
          <Services><ConfDataSet max="1"/></Services>
          <Server>
            <LDevice inst="used"><LN0 lnClass="LLN0" inst=""><DataSet name="ds1"/></LN0></LDevice>
          </Server>
        </AccessPoint>
      </IED>`);
    expect(dataSetAddBlock(found)).toBe('Services > ConfDataSet is missing.');
  });
});

describe('GOOSE add block', () => {
  const ln0 = '<LDevice inst="ld1"><LN0 lnClass="LLN0" inst=""/></LDevice>';

  it('names a missing LN0 before missing services', () => {
    expect(
      gooseAddBlock(
        iedNamed('<IED name="IED"><AccessPoint name="AP1"><Server><LDevice inst="ld1"><LN lnClass="MMXU" inst="1"/></LDevice></Server></AccessPoint></IED>'),
      ),
    ).toBe('This IED has no LN0.');
  });

  it('names missing GOOSE services', () => {
    expect(
      gooseAddBlock(
        iedNamed(`<IED name="IED"><AccessPoint name="AP1"><Server>${ln0}</Server></AccessPoint></IED>`),
      ),
    ).toBe('Services > GOOSE is missing.');
  });

  it('names the GOOSE maximum for the first LN0 scope', () => {
    const full = iedNamed(`
      <IED name="IED">
        <AccessPoint name="AP1">
          <Services><GOOSE max="1"/></Services>
          <Server>
            <LDevice inst="ld1"><LN0 lnClass="LLN0" inst=""><GSEControl name="gse1"/></LN0></LDevice>
          </Server>
        </AccessPoint>
      </IED>`);
    expect(gooseAddBlock(full)).toBe(
      'The maximum number of GOOSE controls (1) has been reached.',
    );

    const open = iedNamed(`
      <IED name="IED">
        <AccessPoint name="AP1">
          <Services><GOOSE max="2"/></Services>
          <Server>
            <LDevice inst="ld1"><LN0 lnClass="LLN0" inst=""><GSEControl name="gse1"/></LN0></LDevice>
          </Server>
        </AccessPoint>
      </IED>`);
    expect(gooseAddBlock(open)).toBeNull();
  });
});

describe('Sampled Value add block', () => {
  const ln0 = '<LDevice inst="ld1"><LN0 lnClass="LLN0" inst=""/></LDevice>';

  it('names a missing LN0 before missing services', () => {
    expect(
      smvAddBlock(
        iedNamed('<IED name="IED"><AccessPoint name="AP1"><Server><LDevice inst="ld1"><LN lnClass="MMXU" inst="1"/></LDevice></Server></AccessPoint></IED>'),
      ),
    ).toBe('This IED has no LN0.');
  });

  it('names missing SMV services', () => {
    expect(
      smvAddBlock(
        iedNamed(`<IED name="IED"><AccessPoint name="AP1"><Server>${ln0}</Server></AccessPoint></IED>`),
      ),
    ).toBe('Services > SMVsc is missing.');
  });

  it('names the Sampled Value maximum for the first LN0 scope', () => {
    const full = iedNamed(`
      <IED name="IED">
        <AccessPoint name="AP1">
          <Services><SMVsc max="1"/></Services>
          <Server>
            <LDevice inst="ld1"><LN0 lnClass="LLN0" inst=""><SampledValueControl name="smv1"/></LN0></LDevice>
          </Server>
        </AccessPoint>
      </IED>`);
    expect(smvAddBlock(full)).toBe(
      'The maximum number of Sampled Value controls (1) has been reached.',
    );

    const open = iedNamed(`
      <IED name="IED">
        <AccessPoint name="AP1">
          <Services><SMVsc max="2"/></Services>
          <Server>
            <LDevice inst="ld1"><LN0 lnClass="LLN0" inst=""><SampledValueControl name="smv1"/></LN0></LDevice>
          </Server>
        </AccessPoint>
      </IED>`);
    expect(smvAddBlock(open)).toBeNull();
  });

  it('uses the access point limit when both scopes define SMVsc', () => {
    const found = iedNamed(`
      <IED name="IED">
        <Services><SMVsc max="5"/></Services>
        <AccessPoint name="AP1">
          <Services><SMVsc max="1"/></Services>
          <Server>
            <LDevice inst="ld1"><LN0 lnClass="LLN0" inst=""><SampledValueControl name="smv1"/></LN0></LDevice>
          </Server>
        </AccessPoint>
      </IED>`);
    expect(smvAddBlock(found)).toBe(
      'The maximum number of Sampled Value controls (1) has been reached.',
    );
  });

  it('uses the IED limit when the access point has no SMVsc', () => {
    const open = iedNamed(`
      <IED name="IED">
        <Services><SMVsc max="2"/></Services>
        <AccessPoint name="AP1">
          <Server>
            <LDevice inst="ld1"><LN0 lnClass="LLN0" inst=""><SampledValueControl name="smv1"/></LN0></LDevice>
          </Server>
        </AccessPoint>
      </IED>`);
    expect(smvAddBlock(open)).toBeNull();
  });
});

describe('report add block', () => {
  it('names a missing LN0 or LN', () => {
    expect(
      reportAddBlock(
        iedNamed('<IED name="IED"><AccessPoint name="AP1"><Server><LDevice inst="ld1"></LDevice></Server></AccessPoint></IED>'),
      ),
    ).toBe('This IED has no LN0 or LN.');
  });

  it('names missing report services', () => {
    expect(
      reportAddBlock(
        iedNamed('<IED name="IED"><AccessPoint name="AP1"><Server><LDevice inst="ld1"><LN0 lnClass="LLN0" inst=""/></LDevice></Server></AccessPoint></IED>'),
      ),
    ).toBe('Services > ConfReportControl is missing.');
  });

  it('names the report maximum before the buffered maximum', () => {
    const full = iedNamed(`
      <IED name="IED">
        <AccessPoint name="AP1">
          <Services><ConfReportControl max="1" maxBuf="1"/></Services>
          <Server>
            <LDevice inst="ld1">
              <LN0 lnClass="LLN0" inst="">
                <ReportControl name="rp1" buffered="true"/>
              </LN0>
            </LDevice>
          </Server>
        </AccessPoint>
      </IED>`);
    expect(reportAddBlock(full)).toBe(
      'The maximum number of report instances (1 of 1) has been reached.',
    );
  });

  it('names the buffered maximum when the total limit still has room', () => {
    const found = iedNamed(`
      <IED name="IED">
        <AccessPoint name="AP1">
          <Services><ConfReportControl max="3" maxBuf="1"/></Services>
          <Server>
            <LDevice inst="ld1">
              <LN0 lnClass="LLN0" inst="">
                <ReportControl name="rp1" buffered="true"><RptEnabled max="1"/></ReportControl>
              </LN0>
            </LDevice>
          </Server>
        </AccessPoint>
      </IED>`);
    expect(reportAddBlock(found)).toBe(
      'The maximum number of buffered report instances (1 of 1) has been reached.',
    );
  });

  it('counts RptEnabled max and allows an LN without LN0', () => {
    const counted = iedNamed(`
      <IED name="IED">
        <AccessPoint name="AP1">
          <Services><ConfReportControl max="2"/></Services>
          <Server>
            <LDevice inst="ld1">
              <LN lnClass="MMXU" inst="1">
                <ReportControl name="rp1" buffered="true"><RptEnabled max="2"/></ReportControl>
              </LN>
            </LDevice>
          </Server>
        </AccessPoint>
      </IED>`);
    expect(reportAddBlock(counted)).toBe(
      'The maximum number of report instances (2 of 2) has been reached.',
    );

    const open = iedNamed(`
      <IED name="IED">
        <AccessPoint name="AP1">
          <Services><ConfReportControl max="5"/></Services>
          <Server>
            <LDevice inst="ld1"><LN lnClass="MMXU" inst="1"/></LDevice>
          </Server>
        </AccessPoint>
      </IED>`);
    expect(reportAddBlock(open)).toBeNull();
  });

  it('sums RptEnabled max of every report in the IED', () => {
    const ied = iedNamed(`
      <IED name="IED">
        <Services><ConfReportControl max="15"/></Services>
        <AccessPoint name="AP1">
          <Server>
            <LDevice inst="ld1">
              <LN0 lnClass="LLN0" inst="">
                <ReportControl name="rp1" buffered="true"/>
                <ReportControl name="rp2" buffered="true"><RptEnabled max="5"/></ReportControl>
              </LN0>
              <LN lnClass="MMXU" inst="1">
                <ReportControl name="rp3"/>
              </LN>
            </LDevice>
          </Server>
        </AccessPoint>
      </IED>`);
    expect(reportUsage(ied)).toEqual({ instances: 7, max: 15 });
    expect(reportAddBlock(ied)).toBeNull();

    const full = iedNamed(`
      <IED name="IED">
        <AccessPoint name="AP1">
          <Services><ConfReportControl max="2"/></Services>
          <Server>
            <LDevice inst="ld1">
              <LN0 lnClass="LLN0" inst="">
                <ReportControl name="rp1" buffered="true"/>
              </LN0>
              <LN lnClass="MMXU" inst="1">
                <ReportControl name="rp2" buffered="true"><RptEnabled max="2"/></ReportControl>
              </LN>
            </LDevice>
          </Server>
        </AccessPoint>
      </IED>`);
    expect(reportUsage(full)).toEqual({ instances: 3, max: 2 });
    expect(reportAddBlock(full)).toBe(
      'The maximum number of report instances (3 of 2) has been reached.',
    );
  });
});

describe('LDevice row block', () => {
  function device(inner: string): Element {
    const found = iedNamed(`
      <IED name="IED">
        <AccessPoint name="AP1"><Server>${inner}</Server></AccessPoint>
      </IED>`).querySelector('LDevice');
    if (!found) throw new Error('missing LDevice');
    return found;
  }

  it('lets GOOSE and Sampled Value use an LDevice with LN0 only', () => {
    const ready = device('<LDevice inst="ld1"><LN0 lnClass="LLN0" inst=""/></LDevice>');
    expect(gooseLDeviceBlock(ready)).toBeNull();
    expect(smvLDeviceBlock(ready)).toBeNull();
  });

  it('blocks GOOSE and Sampled Value when the LDevice has no LN0', () => {
    const logicalNode = device('<LDevice inst="ld1"><LN lnClass="MMXU" inst="1"/></LDevice>');
    const empty = device('<LDevice inst="ld1"></LDevice>');
    expect(gooseLDeviceBlock(logicalNode)).toBe('This LDevice has no LN0.');
    expect(smvLDeviceBlock(logicalNode)).toBe('This LDevice has no LN0.');
    expect(gooseLDeviceBlock(empty)).toBe('This LDevice has no LN0.');
    expect(smvLDeviceBlock(empty)).toBe('This LDevice has no LN0.');
  });

  it('lets a Report use an LN0 or an LN and blocks an empty LDevice', () => {
    const ln0 = device('<LDevice inst="ld1"><LN0 lnClass="LLN0" inst=""/></LDevice>');
    const ln = device('<LDevice inst="ld1"><LN lnClass="MMXU" inst="1"/></LDevice>');
    const empty = device('<LDevice inst="ld1"></LDevice>');
    expect(reportLDeviceBlock(ln0)).toBeNull();
    expect(reportLDeviceBlock(ln)).toBeNull();
    expect(reportLDeviceBlock(empty)).toBe('This LDevice has no LN0 or LN.');
  });
});

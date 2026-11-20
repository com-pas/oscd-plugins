/**
 * Why the list plus cannot add an entry. `null` means the dialog can open.
 * The checks follow scl-lib: the first LN0 for GOOSE and Sampled Value, and
 * each LDevice's LN0 for a Data Set. Reports sum every ReportControl in the
 * IED. The first matching reason wins: missing structure, then a missing
 * Services element, then the maximum.
 */

const dataSetCountSelector =
  ':scope Server > LDevice > LN0 > DataSet, :scope Server > LDevice > LN > DataSet';

/** LDevices directly under this IED's access points. */
export function iedLDevices(ied: Element): Element[] {
  return Array.from(ied.querySelectorAll(':scope > AccessPoint > Server > LDevice'));
}

/** `max` is null when neither AccessPoint nor IED defines ConfDataSet.max. */
function dataSetLimit(ln: Element): { scope: Element; max: number | null } | null {
  const accessPoint = ln.closest('AccessPoint');
  const ied = ln.closest('IED');
  const accessPointMax = accessPoint
    ?.querySelector(':scope > Services > ConfDataSet')
    ?.getAttribute('max');
  if (accessPoint && accessPointMax) {
    return { scope: accessPoint, max: parseInt(accessPointMax, 10) };
  }
  const iedMax = ied?.querySelector(':scope > Services > ConfDataSet')?.getAttribute('max');
  if (ied && iedMax) return { scope: ied, max: parseInt(iedMax, 10) };
  if (!ied) return null;
  return { scope: ied, max: null };
}

function dataSetRoom(ln: Element): { ok: boolean; max: number | null } {
  const limit = dataSetLimit(ln);
  if (!limit || (limit.max !== null && Number.isNaN(limit.max))) {
    return { ok: false, max: null };
  }
  const count = limit.scope.querySelectorAll(dataSetCountSelector).length;
  if (limit.max === null) {
    const fallback = limit.scope.querySelectorAll(
      ':scope > AccessPoint > Server > LDevice DataSet',
    ).length;
    return { ok: fallback > count, max: null };
  }
  return { ok: limit.max > count, max: limit.max };
}

/** Reason a single LDevice cannot receive a Data Set. */
export function dataSetLDeviceBlock(lDevice: Element): string | null {
  const ln0 = lDevice.querySelector(':scope > LN0');
  if (!ln0) return 'This LDevice has no LN0.';
  const room = dataSetRoom(ln0);
  if (room.ok) return null;
  if (room.max === null) return 'Services > ConfDataSet is missing.';
  return `The maximum number of DataSets (${room.max}) has been reached.`;
}

/** Reason this IED's Data Set plus cannot open the dialog. */
export function dataSetAddBlock(ied: Element): string | null {
  const devices = iedLDevices(ied);
  if (devices.length === 0) return 'This IED has no LDevice.';
  const blocks = devices.map(dataSetLDeviceBlock);
  if (blocks.some(block => block === null)) return null;
  if (blocks.every(block => block === 'This LDevice has no LN0.')) {
    return 'This IED has no LN0.';
  }
  return (
    blocks.find(block => block === 'Services > ConfDataSet is missing.') ??
    blocks.find(block => block?.startsWith('The maximum number of DataSets')) ??
    'This IED has no LN0.'
  );
}

/** Reason this IED's GOOSE plus cannot open the dialog. */
export function gooseAddBlock(ied: Element): string | null {
  const ln0 = ied.querySelector('LN0');
  if (!ln0) return 'This IED has no LN0.';
  const accessPointGoose = ln0
    .closest('AccessPoint')
    ?.querySelector(':scope > Services > GOOSE');
  const goose = accessPointGoose ?? ied.querySelector(':scope > Services > GOOSE');
  if (!goose) return 'Services > GOOSE is missing.';
  const max = parseInt(goose.getAttribute('max') ?? '0', 10);
  const scope = accessPointGoose ? ln0.closest('AccessPoint') : ied;
  const existing = scope?.querySelectorAll(':scope Server > LDevice > LN0 > GSEControl').length ?? 0;
  if (Number.isNaN(max) || !(max > existing)) {
    return `The maximum number of GOOSE controls (${Number.isNaN(max) ? 0 : max}) has been reached.`;
  }
  return null;
}

/** Reason this IED's Sampled Value plus cannot open the dialog. */
export function smvAddBlock(ied: Element): string | null {
  const ln0 = ied.querySelector('LN0');
  if (!ln0) return 'This IED has no LN0.';
  const accessPointSmv = ln0
    .closest('AccessPoint')
    ?.querySelector(':scope > Services > SMVsc');
  const smv = accessPointSmv ?? ied.querySelector(':scope > Services > SMVsc');
  if (!smv) return 'Services > SMVsc is missing.';
  const max = parseInt(smv.getAttribute('max') ?? '0', 10);
  const scope = accessPointSmv ? ln0.closest('AccessPoint') : ied;
  const existing =
    scope?.querySelectorAll(':scope Server > LDevice > LN0 > SampledValueControl').length ?? 0;
  if (Number.isNaN(max) || !(max > existing)) {
    return `The maximum number of Sampled Value controls (${Number.isNaN(max) ? 0 : max}) has been reached.`;
  }
  return null;
}

/** Reason one LDevice cannot receive a GOOSE. The maximum stays on the plus. */
export function gooseLDeviceBlock(lDevice: Element): string | null {
  return lDevice.querySelector(':scope > LN0') ? null : 'This LDevice has no LN0.';
}

/** Reason one LDevice cannot receive a Sampled Value. The maximum stays on the plus. */
export function smvLDeviceBlock(lDevice: Element): string | null {
  return lDevice.querySelector(':scope > LN0') ? null : 'This LDevice has no LN0.';
}

const reportControlSelector =
  ':scope > AccessPoint > Server > LDevice > LN0 > ReportControl, :scope > AccessPoint > Server > LDevice > LN > ReportControl';

/** `RptEnabled@max`, or 1 when the element or the attribute is missing. */
function rptEnabledMax(report: Element): number {
  return parseInt(report.querySelector(':scope > RptEnabled')?.getAttribute('max') ?? '1', 10);
}

function reportControls(ied: Element): Element[] {
  return Array.from(ied.querySelectorAll(reportControlSelector));
}

function reportInstances(reports: Element[], buffered: boolean): number {
  return reports
    .filter(report => {
      const value = report.getAttribute('buffered');
      return buffered ? value === 'true' : value === null || value === 'false';
    })
    .map(rptEnabledMax)
    .reduce((sum, value) => sum + value, 0);
}

/** Instance sum and `ConfReportControl@max` for the reports listed under this IED. */
export function reportUsage(ied: Element): { instances: number; max: number | null } {
  const parent = ied.querySelector('LN0, LN');
  if (!parent) return { instances: 0, max: null };
  const { max } = reportMax(parent);
  const reports = reportControls(ied);
  return {
    instances: reportInstances(reports, true) + reportInstances(reports, false),
    max: Number.isNaN(max) || max < 0 ? null : max,
  };
}

function reportMax(node: Element): { max: number; maxBuf: number } {
  const selector = ':scope > Services > ConfReportControl';
  const elements = [node.closest('IED'), node.closest('AccessPoint')].map(root =>
    root?.querySelector(selector),
  );
  const read = (name: string) =>
    Math.max(...elements.map(element => parseInt(element?.getAttribute(name) ?? '-1', 10)));
  return { max: read('max'), maxBuf: read('maxBuf') };
}

/** Reason this IED's Report plus cannot open the dialog. */
export function reportAddBlock(ied: Element): string | null {
  const parent = ied.querySelector('LN0, LN');
  if (!parent) return 'This IED has no LN0 or LN.';
  const { max, maxBuf } = reportMax(parent);
  if (Number.isNaN(max) || max < 0) return 'Services > ConfReportControl is missing.';
  const reports = reportControls(ied);
  const buffered = reportInstances(reports, true);
  const unbuffered = reportInstances(reports, false);
  const instances = buffered + unbuffered;
  if (instances + 1 > max) {
    return `The maximum number of report instances (${instances} of ${max}) has been reached.`;
  }
  const bufferedCeiling = maxBuf < 0 || Number.isNaN(maxBuf) ? max : maxBuf;
  if (bufferedCeiling < buffered + 1) {
    return `The maximum number of buffered report instances (${buffered} of ${bufferedCeiling}) has been reached.`;
  }
  return null;
}

/** Reason one LDevice cannot receive a Report. The maximum stays on the plus. */
export function reportLDeviceBlock(lDevice: Element): string | null {
  return lDevice.querySelector(':scope > LN0, :scope > LN')
    ? null
    : 'This LDevice has no LN0 or LN.';
}

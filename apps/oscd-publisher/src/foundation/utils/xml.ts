export function queryDataTypeLeaf(
  dataTypeTemplates: Element,
  lnType: string,
  doSegments: string[],
  daSegments: string[]
): Element | null {
  const lNodeType = dataTypeTemplates.querySelector(
    `LNodeType[id="${lnType}"]`
  );
  if (!lNodeType) {
    return null;
  }

  let leaf = lNodeType;

  for (const doSegement of doSegments) {
    const dataObject = leaf.querySelector(
      `DO[name="${doSegement}"], SDO[name="${doSegement}"]`
    );
    if (!dataObject) {
      return null;
    }

    const doType = dataObject.getAttribute('type');
    if (!doType) {
      return null;
    }

    const doTypeElement = dataTypeTemplates.querySelector(
      `DOType[id="${doType}"]`
    );
    if (!doTypeElement) {
      return null;
    }

    leaf = doTypeElement;
  }

  for (const [index, daSegment] of daSegments.entries()) {
    const dataAttribute = leaf.querySelector(
      `DA[name="${daSegment}"], BDA[name="${daSegment}"]`
    );
    if (!dataAttribute) {
      return null;
    }

    const isLastEntry = index === daSegments.length - 1;
    if (isLastEntry) {
      // Do not search for type, because last entry is a leaf node and should be basic type
      break;
    }

    const daType = dataAttribute.getAttribute('type');
    if (!daType) {
      return null;
    }

    const daTypeElement = dataTypeTemplates.querySelector(
      `DAType[id="${daType}"]`
    );
    if (!daTypeElement) {
      return null;
    }

    leaf = daTypeElement;
  }

  return leaf;
}

export function hasDataType(
  dataTypeTemplates: Element,
  lnType: string,
  doSegments: string[],
  daSegments: string[]
): boolean {
  const leaf = queryDataTypeLeaf(
    dataTypeTemplates,
    lnType,
    doSegments,
    daSegments
  );

  return Boolean(leaf);
}

export function queryLN(
  lDevice: Element,
  lnClass: string,
  inst: string,
  prefix: string | null
): Element | null {
  // tLN0 fixes lnClass to LLN0 and inst to empty. A missing inst does not match.
  if (lnClass === 'LLN0' && inst === '') {
    return lDevice.querySelector(':scope > LN0[lnClass="LLN0"][inst=""]');
  }

  let lnQuery = `:scope > LN[lnClass="${lnClass}"][inst="${inst}"]`;

  if (prefix) {
    lnQuery += `[prefix="${prefix}"]`;
  } else {
    lnQuery += `:not([prefix]), ${lnQuery}[prefix=""]`;
  }

  return lDevice.querySelector(lnQuery);
}

export function queryLDevice(ied: Element, inst: string): Element | null {
  return ied.querySelector(
    `:scope > AccessPoint > Server > LDevice[inst="${inst}"]`
  );
}

export interface CopyHost {
  ldInst: string;
  lnClass: string;
  inst: string;
  prefix: string | null;
}

const ln0Mismatch = 'LN0 is not LLN0 or inst is not ""';

function fcdaReference(fcda: Element): string {
  const ldInst = fcda.getAttribute('ldInst') ?? '';
  const prefix = fcda.getAttribute('prefix') ?? '';
  const lnClass = fcda.getAttribute('lnClass') ?? '';
  const lnInst = fcda.getAttribute('lnInst') ?? '';
  const doName = fcda.getAttribute('doName') ?? '';
  const daName = fcda.getAttribute('daName') ?? '';
  const data = daName ? `${doName}.${daName}` : doName;
  return `${ldInst}/${prefix}${lnClass}${lnInst}.${data}`;
}

function dataPath(doName: string, daName: string | null): string {
  return daName ? `${doName}.${daName}` : doName;
}

/** Why this logical node is absent on the target, or null when it is present. */
export function copyHostMismatch(ied: Element, host: CopyHost): string | null {
  if (!host.ldInst) return 'Logical device is missing';
  const lDevice = queryLDevice(ied, host.ldInst);
  if (!lDevice) return `Logical device ${host.ldInst} is missing`;
  if (queryLN(lDevice, host.lnClass, host.inst, host.prefix)) return null;
  if (host.lnClass === 'LLN0' && host.inst === '') return ln0Mismatch;
  const name = `${host.prefix ?? ''}${host.lnClass}${host.inst}`;
  return `Logical node ${name} is missing`;
}

function direct(parent: Element, selector: string): Element | null {
  return parent.querySelector(`:scope > ${selector}`);
}

function named(parent: Element, tag: string, name: string): Element | null {
  return direct(parent, `${tag}[name="${name}"]`);
}

function doTypeOf(templates: Element, id: string | null): Element | null {
  if (!id) return null;
  return templates.querySelector(`DOType[id="${id}"]`);
}

function daTypeOf(templates: Element, id: string | null): Element | null {
  if (!id) return null;
  return templates.querySelector(`DAType[id="${id}"]`);
}

/** True when this DOType, or an SDO under it, has a DA with fc. */
function doTypeHasFc(
  doType: Element,
  templates: Element,
  fc: string,
  seen: Set<string>,
): boolean {
  const id = doType.getAttribute('id');
  if (id) {
    if (seen.has(id)) return false;
    seen.add(id);
  }
  for (const da of Array.from(doType.querySelectorAll(':scope > DA'))) {
    if (da.getAttribute('fc') === fc) return true;
  }
  for (const sdo of Array.from(doType.querySelectorAll(':scope > SDO'))) {
    const next = doTypeOf(templates, sdo.getAttribute('type'));
    if (next && doTypeHasFc(next, templates, fc, seen)) return true;
  }
  return false;
}

/**
 * Path and functional constraint of one FCDA against a logical node type.
 * A BDA has no fc; the DA above it owns the constraint.
 * Without daName the data object matches when any DA in its type has fc.
 */
function pathConstraint(
  templates: Element,
  lnType: string,
  doName: string,
  daName: string | null,
  fc: string | null,
): 'path' | 'fc' | 'ok' {
  const lNodeType = templates.querySelector(`LNodeType[id="${lnType}"]`);
  if (!lNodeType || !fc) return !lNodeType ? 'path' : 'fc';

  let leaf: Element = lNodeType;
  for (const segment of doName.split('.')) {
    const dataObject = named(leaf, 'DO', segment) ?? named(leaf, 'SDO', segment);
    if (!dataObject) return 'path';
    const doType = doTypeOf(templates, dataObject.getAttribute('type'));
    if (!doType) return 'path';
    leaf = doType;
  }

  if (!daName) {
    return doTypeHasFc(leaf, templates, fc, new Set()) ? 'ok' : 'fc';
  }

  let ownerFc: string | null = null;
  const segments = daName.split('.');
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const dataAttribute = named(leaf, 'DA', segment) ?? named(leaf, 'BDA', segment);
    if (!dataAttribute) return 'path';
    if (dataAttribute.tagName === 'DA') ownerFc = dataAttribute.getAttribute('fc');
    const isLast = index === segments.length - 1;
    if (isLast) break;
    const daType = daTypeOf(templates, dataAttribute.getAttribute('type'));
    if (!daType) return 'path';
    leaf = daType;
  }

  return ownerFc === fc ? 'ok' : 'fc';
}

/** Why this FCDA does not exist on the IED, or null when the copy can use it. */
export function fcdaCopyMismatch(fcda: Element, ied: Element): string | null {
  const ldInst = fcda.getAttribute('ldInst');
  const lnClass = fcda.getAttribute('lnClass');
  const prefix = fcda.getAttribute('prefix');
  const lnInst = fcda.getAttribute('lnInst') ?? '';
  const doName = fcda.getAttribute('doName');
  const daName = fcda.getAttribute('daName');
  const fc = fcda.getAttribute('fc');

  if (!ldInst) return 'Logical device is missing';
  if (!doName) return 'Data path is missing';

  const lDevice = queryLDevice(ied, ldInst);
  if (!lDevice) return `Logical device ${ldInst} is missing`;

  const isLln0 = lnClass === 'LLN0' && lnInst === '';
  if (!lnClass || (!isLln0 && lnInst === '')) {
    const name = `${prefix ?? ''}${lnClass ?? ''}${lnInst}`;
    return `Logical node ${name} is missing`;
  }

  const ln = queryLN(lDevice, lnClass, lnInst, prefix);
  if (!ln) return isLln0 ? ln0Mismatch : `Logical node ${prefix ?? ''}${lnClass}${lnInst} is missing`;

  const lnType = ln.getAttribute('lnType');
  const templates = ied.parentElement?.querySelector('DataTypeTemplates');
  const path = dataPath(doName, daName);
  if (!lnType || !templates) return `Data path ${path} is missing`;

  const result = pathConstraint(templates, lnType, doName, daName, fc);
  if (result === 'path') return `Data path ${path} is missing`;
  if (result === 'fc') return `Functional constraint ${fc ?? ''} does not match`;
  return null;
}

export function isFCDACompatibleWithIED(fcda: Element, ied: Element): boolean {
  return fcdaCopyMismatch(fcda, ied) === null;
}

/** First structure failure, then how many further failures there are. */
export function copyIncompatibilityTitle(
  ied: Element,
  host: CopyHost,
  fcdas: readonly Element[],
): string {
  const failures: string[] = [];
  const hostReason = copyHostMismatch(ied, host);
  if (hostReason) failures.push(hostReason);
  for (const fcda of fcdas) {
    const reason = fcdaCopyMismatch(fcda, ied);
    if (reason) failures.push(`${fcdaReference(fcda)}: ${reason}`);
  }
  if (failures.length === 0) return '';
  const more = failures.length - 1;
  if (more === 0) return failures[0];
  return `${failures[0]}. ${more} more.`;
}

import sampleIeds from './files/sample-ieds.scd?raw';
import newProject1 from './files/new-project-1.scd?raw';
import newProject2 from './files/new-project-2.scd?raw';
import newProject21 from './files/new-project-2.1.scd?raw';
import publisherDatasetCopyTest from './files/publisher-dataset_copy-test.scd?raw';
import publisherGoose from './files/publisher-goose.scd?raw';
import publisherGoose2 from './files/publisher-goose-2.scd?raw';
import publisherGooseWithDesc from './files/publisher-goose-with-desc.scd?raw';
import publisherGooseWithoutServices from './files/publisher-goose-without-services.scd?raw';
import publisherGooseMax from './files/publisher-goose-max.scd?raw';
import publisherReport from './files/publisher-report.scd?raw';
import publisherReport2 from './files/publisher-report-2.scd?raw';
import publisherReportWithDesc from './files/publisher-report-with-desc.scd?raw';
import publisherSmv from './files/publisher-smv.scd?raw';
import publisherSmv2 from './files/publisher-smv-2.scd?raw';
import publisherSmvWithDesc from './files/publisher-smv-with-desc.scd?raw';
import sampleIedWithMultipleLDevice from './files/sample-ied-with-multiple-ldevice.scd?raw';
import { fakeHostProps, notifyFakeHost } from './fake-host-props';
import { syncXmlInspector } from './xml-inspector';

/** Loaded with fetch so Vite does not inline the file into the module graph. */
export const LARGE_PLAYGROUND_DOC = 'ABC_Large_File_anonymised_updated_3.scd';

type RawPlaygroundDoc = { kind: 'raw'; source: string };
type UrlPlaygroundDoc = { kind: 'url'; url: string };
type PlaygroundDocEntry = RawPlaygroundDoc | UrlPlaygroundDoc;

const raw = (source: string): RawPlaygroundDoc => ({ kind: 'raw', source });

/**
 * Registry of standalone playground SCL files.
 * Add a file under `dev/files/`, then add an entry here.
 * Small files are Vite `?raw` strings. The large file is fetched at runtime.
 */
export const PLAYGROUND_DOCS = {
  'sample-ieds.scd': raw(sampleIeds),
  'new-project-1.scd': raw(newProject1),
  'new-project-2.scd': raw(newProject2),
  'new-project-2.1.scd': raw(newProject21),
  'publisher-dataset_copy-test.scd': raw(publisherDatasetCopyTest),
  'publisher-goose.scd': raw(publisherGoose),
  'publisher-goose-2.scd': raw(publisherGoose2),
  'publisher-goose-with-desc.scd': raw(publisherGooseWithDesc),
  'publisher-goose-without-services.scd': raw(publisherGooseWithoutServices),
  'publisher-goose-max.scd': raw(publisherGooseMax),
  'publisher-report.scd': raw(publisherReport),
  'publisher-report-2.scd': raw(publisherReport2),
  'publisher-report-with-desc.scd': raw(publisherReportWithDesc),
  'publisher-smv.scd': raw(publisherSmv),
  'publisher-smv-2.scd': raw(publisherSmv2),
  'publisher-smv-with-desc.scd': raw(publisherSmvWithDesc),
  'sample-ied-with-multiple-ldevice.scd': raw(sampleIedWithMultipleLDevice),
  [LARGE_PLAYGROUND_DOC]: {
    kind: 'url',
    url: new URL(`./files/${LARGE_PLAYGROUND_DOC}`, import.meta.url).href,
  },
} as const satisfies Record<string, PlaygroundDocEntry>;

export type PlaygroundDocName = keyof typeof PLAYGROUND_DOCS;

export interface ThemePlaygroundDocOptions {
  relevantDocs: string[];
  defaultDoc: string;
}

export function listUnknownPlaygroundDocs(names: readonly string[]): string[] {
  const known = new Set(Object.keys(PLAYGROUND_DOCS));
  return [...new Set(names.filter((name) => !known.has(name)))];
}

export function assertPlaygroundDocOptions(
  options: ThemePlaygroundDocOptions,
): void {
  const unknown = listUnknownPlaygroundDocs([
    ...options.relevantDocs,
    options.defaultDoc,
  ]);
  if (unknown.length > 0) {
    throw new Error(
      `Unknown playground document(s): ${unknown.join(', ')}. ` +
        `Available: ${Object.keys(PLAYGROUND_DOCS).join(', ')}`,
    );
  }
  if (!options.relevantDocs.includes(options.defaultDoc)) {
    throw new Error(
      `defaultDoc "${options.defaultDoc}" is not listed in relevantDocs ` +
        `(${options.relevantDocs.join(', ')})`,
    );
  }
}

function playgroundEntry(name: string): PlaygroundDocEntry {
  const entry = PLAYGROUND_DOCS[name as PlaygroundDocName];
  if (entry === undefined) {
    throw new Error(
      `Unknown playground document(s): ${name}. ` +
        `Available: ${Object.keys(PLAYGROUND_DOCS).join(', ')}`,
    );
  }
  return entry;
}

function parseXml(xml: string): XMLDocument {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

/** Synchronous parse for `?raw` files. URL entries must use `loadPlaygroundDocument`. */
export function parsePlaygroundDocument(name: string): XMLDocument {
  const entry = playgroundEntry(name);
  if (entry.kind !== 'raw') {
    throw new Error(
      `${name} is loaded with fetch. Use loadPlaygroundDocument().`,
    );
  }
  return parseXml(entry.source);
}

export async function loadPlaygroundDocumentSource(name: string): Promise<string> {
  const entry = playgroundEntry(name);
  if (entry.kind === 'raw') return entry.source;
  const response = await fetch(entry.url);
  if (!response.ok) {
    throw new Error(`Failed to load playground document ${name} (${response.status})`);
  }
  return response.text();
}

export async function loadPlaygroundDocument(name: string): Promise<XMLDocument> {
  return parseXml(await loadPlaygroundDocumentSource(name));
}

export async function applyPlaygroundDocument(name: string): Promise<void> {
  const source = await loadPlaygroundDocumentSource(name);
  fakeHostProps.doc = parseXml(source);
  fakeHostProps.docName = name;
  fakeHostProps.editCount += 1;
  notifyFakeHost();
  syncXmlInspector(source);
}

export function createSampleDocument(): XMLDocument {
  return parsePlaygroundDocument('sample-ieds.scd');
}

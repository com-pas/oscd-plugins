import '@webcomponents/scoped-custom-element-registry';

import PublisherPlugin from './oscd-publisher';
import { bindFakeHost } from './bind-fake-host';
// Production loads oscd-publisher.ts (not this file) and must not include these rules.
// eslint-disable-next-line @nx/enforce-module-boundaries -- dev-only helpers outside the lib graph; main.ts is not the production entry
import { initThemePlayground } from '../../../libs/global/dev/theme-playground';
// eslint-disable-next-line @nx/enforce-module-boundaries -- dev-only; not the production entry
import { initFakeHostDocument } from '../../../libs/global/dev/fake-open-scd';

const DEV_TAG = 'oscd-publisher-dev';

const target = document.getElementById('app');
if (!target) throw new Error('Missing app mount element');

if (import.meta.env?.DEV) {
  await initThemePlayground({
    relevantDocs: [
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
      'sample-ied-with-multiple-ldevice.scd',
      'ABC_Large_File_anonymised_updated_3.scd',
    ],
    defaultDoc: 'ABC_Large_File_anonymised_updated_3.scd',
  });
}

initFakeHostDocument(target);

if (!customElements.get(DEV_TAG)) {
  customElements.define(DEV_TAG, PublisherPlugin);
}

const plugin = document.createElement(DEV_TAG) as PublisherPlugin;
plugin.style.height = '100%';
target.appendChild(plugin);
bindFakeHost(plugin);

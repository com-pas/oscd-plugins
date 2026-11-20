// eslint-disable-next-line @nx/enforce-module-boundaries -- playground-only; not the production entry
import {
  fakeHostProps,
  subscribeFakeHost,
} from '../../../libs/global/dev/fake-host-props';
import type PublisherPlugin from './oscd-publisher';

/** Push fake-host document props onto the Lit plugin (standalone `main.ts` only). */
export function bindFakeHost(plugin: PublisherPlugin): () => void {
  return subscribeFakeHost(() => {
    if (fakeHostProps.doc) {
      plugin.doc = fakeHostProps.doc;
    }
    plugin.editCount = fakeHostProps.editCount;
  });
}

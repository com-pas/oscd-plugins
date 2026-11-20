/**
 * Host props for standalone plugin `main.ts` (not production entries).
 * Mirrors the OpenSCD custom-element `plugins` input plus document/host.
 *
 * Writers call `notifyFakeHost()` after they change the object.
 * `subscribeFakeHost` runs once immediately, then on each notify.
 */
export type FakeHostPlugin = {
  name: string;
  src: string;
  kind: string;
  icon?: string;
  active?: boolean;
  author?: string;
  description?: string;
  requireDoc?: boolean;
  position?: string;
  activeByDefault?: boolean;
  installed?: boolean;
  [key: string]: unknown;
};

export const fakeHostProps = {
  plugins: [] as FakeHostPlugin[],
  doc: undefined as XMLDocument | undefined,
  docName: '',
  editCount: 0,
  host: undefined as HTMLElement | undefined,
};

const listeners = new Set<() => void>();

export function subscribeFakeHost(listener: () => void): () => void {
  listeners.add(listener);
  listener();
  return () => {
    listeners.delete(listener);
  };
}

export function notifyFakeHost(): void {
  for (const listener of listeners) listener();
}

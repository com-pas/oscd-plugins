/**
 * Minimal typing for the OpenSCD / CoMPAS host custom element.
 * TypeScript `private` methods on the host are still callable at runtime.
 */
export interface OpenScdHost extends HTMLElement {
  getBuiltInPlugins?(): unknown;
}

/**
 * Returns the OpenSCD host element (`<open-scd>`) or null if not found.
 *
 * @returns The host element, or `null` when it is not in the document.
 */
export function getOpenSCDHost(): OpenScdHost | null {
  return document.querySelector('open-scd');
}

/**
 * Returns the `<compas-layout>` or `<oscd-layout>` inside the OpenSCD shadow DOM,
 * or null if not found.
 *
 * @returns The layout element, or `null` when the host or layout is missing.
 */
export function getLayout(): HTMLElement | null {
  const openScd = getOpenSCDHost();
  if (!openScd?.shadowRoot) return null;
  return (
    openScd.shadowRoot.querySelector('compas-layout') ??
    openScd.shadowRoot.querySelector('oscd-layout') ??
    null
  );
}

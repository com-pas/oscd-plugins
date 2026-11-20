import { findControlBlockSubscription } from '@openenergytools/scl-lib';

/** Shown while an ExtRef subscription blocks unlink and data set changes. */
export const subscribedDataSetTitle =
  'Subscribed by another IED. Cannot unlink or change the data set.';

/** True when an ExtRef subscribes to this control block. */
export function dataSetLinkLocked(
  control: Element | null | undefined,
): boolean {
  return !!control && findControlBlockSubscription(control).length > 0;
}

/** Host log event (`oscd-edit` sibling). Kept local so we do not pull Lit 2 via `@compas-oscd/core`. */
export function newLogEvent(
  detail: { title: string; kind?: string; message?: string },
  eventInitDict?: CustomEventInit,
): CustomEvent {
  return new CustomEvent('log', {
    bubbles: true,
    composed: true,
    ...eventInitDict,
    detail: { ...detail, ...eventInitDict?.detail },
  });
}

import { getLayout } from './open-scd-helpers';

/** Inline styles written onto the CompasLayout plugin-container. */
const LAYOUT_HACK_HEIGHT = 'calc(100vh - 4px)';
const LAYOUT_HACK_DISPLAY = 'flex';
const LAYOUT_HACK_FLEX_DIRECTION = 'column';

/**
 * Saved inline styles so {@link restoreLayoutHack} can undo {@link applyLayoutHack}.
 */
export interface LayoutHackState {
  targetDiv: HTMLDivElement | null;
  originalStyles: {
    height?: string;
    display?: string;
    flexDirection?: string;
  };
}

/**
 * Constrains the CoMPAS / OpenSCD plugin-container so the plugin can fill the
 * viewport height.
 * 
 * Should be obsolete with https://github.com/com-pas/open-scd/issues/173,
 * but still needed for older distributions:
 *
 * Older CompasLayout versions did not limit the first inner `div` to the
 * window height and did not use a column flex layout, which broke plugin
 * styling (content overflowed or failed to stretch). This writes the missing
 * inline styles on that container:
 * - `height: calc(100vh - 4px)` — 4px is the bottom progress bar from the
 *   oscd-waiter wrapper
 * - `display: flex`
 * - `flex-direction: column`
 *
 * Newer CompasLayout instances already ship this styling. Re-applying the same
 * values is a visual no-op and must not break those hosts: original inline
 * styles are saved and restored by {@link restoreLayoutHack} (CSS rules on
 * newer layouts stay in effect after restore).
 *
 * @returns State to pass to {@link restoreLayoutHack}, or `null` when no
 *   layout / container was found.
 */
export function applyLayoutHack(): LayoutHackState | null {
  const layout = getLayout();
  if (!layout?.shadowRoot) return null;

  const targetDiv = layout.shadowRoot.querySelector('div');
  if (!(targetDiv instanceof HTMLDivElement)) return null;

  const originalStyles = {
    height: targetDiv.style.height,
    display: targetDiv.style.display,
    flexDirection: targetDiv.style.flexDirection,
  };

  targetDiv.style.height = LAYOUT_HACK_HEIGHT;
  targetDiv.style.display = LAYOUT_HACK_DISPLAY;
  targetDiv.style.flexDirection = LAYOUT_HACK_FLEX_DIRECTION;

  return { targetDiv, originalStyles };
}

/**
 * Restores inline styles saved by {@link applyLayoutHack}.
 *
 * Safe to call with `null` / `undefined` (no-op). After restore, newer
 * CompasLayout hosts keep their own CSS; older hosts return to the unfixed
 * container until another plugin applies the hack.
 *
 * @param state - Handle from {@link applyLayoutHack}.
 */
export function restoreLayoutHack(
  state: LayoutHackState | null | undefined,
): void {
  if (!state?.targetDiv) return;

  state.targetDiv.style.height = state.originalStyles.height ?? '';
  state.targetDiv.style.display = state.originalStyles.display ?? '';
  state.targetDiv.style.flexDirection =
    state.originalStyles.flexDirection ?? '';

  state.targetDiv = null;
}

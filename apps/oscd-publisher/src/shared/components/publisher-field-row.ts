import { css } from 'lit';

/** Lock column shared by publisher fields so every control lines up. */
export const publisherFieldRowStyles = css`
  :host {
    display: block;
    min-width: 0;
    box-sizing: border-box;
    color: var(--oscd-plugin-internal-base03);
    font-family: var(--oscd-plugin-internal-text-font);
    font-size: 14px;
  }

  .row {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    column-gap: 12px;
    align-items: center;
  }

  .lock-slot {
    width: 32px;
    height: 32px;
  }

  .lock {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: var(--oscd-plugin-internal-shape-extra-small);
    background: transparent;
    color: var(--oscd-plugin-internal-base0);
    cursor: pointer;
  }

  .lock[aria-pressed='true'] {
    color: var(--oscd-plugin-internal-base03);
  }

  .lock:hover {
    background: var(--oscd-plugin-internal-base2);
  }

  .lock:disabled {
    pointer-events: none;
  }

  .lock-slot:has(.lock:disabled) {
    cursor: not-allowed;
  }

  md-icon {
    font-size: 22px;
  }
`;

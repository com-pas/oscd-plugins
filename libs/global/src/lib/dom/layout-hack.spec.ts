import { describe, it, expect, afterEach } from 'vitest';
import { applyLayoutHack, restoreLayoutHack } from './layout-hack';

afterEach(() => {
  document.body.replaceChildren();
});

function mountLayoutContainer(options?: {
  existingStyles?: {
    height?: string;
    display?: string;
    flexDirection?: string;
  };
}): HTMLDivElement {
  const host = document.createElement('open-scd');
  const hostShadow = host.attachShadow({ mode: 'open' });
  const layout = document.createElement('compas-layout');
  const layoutShadow = layout.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  if (options?.existingStyles?.height !== undefined) {
    container.style.height = options.existingStyles.height;
  }
  if (options?.existingStyles?.display !== undefined) {
    container.style.display = options.existingStyles.display;
  }
  if (options?.existingStyles?.flexDirection !== undefined) {
    container.style.flexDirection = options.existingStyles.flexDirection;
  }
  layoutShadow.appendChild(container);
  hostShadow.appendChild(layout);
  document.body.appendChild(host);
  return container;
}

describe('applyLayoutHack', () => {
  it('returns null when no open-scd host exists', () => {
    expect(applyLayoutHack()).toBeNull();
  });

  it('returns null when the layout has no shadow root', () => {
    const host = document.createElement('open-scd');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.appendChild(document.createElement('compas-layout'));
    document.body.appendChild(host);
    expect(applyLayoutHack()).toBeNull();
  });

  it('returns null when the layout shadow root has no div', () => {
    const host = document.createElement('open-scd');
    const hostShadow = host.attachShadow({ mode: 'open' });
    const layout = document.createElement('compas-layout');
    layout.attachShadow({ mode: 'open' });
    hostShadow.appendChild(layout);
    document.body.appendChild(host);
    expect(applyLayoutHack()).toBeNull();
  });

  it('applies height, flex display and column direction on the plugin container', () => {
    const container = mountLayoutContainer();
    const state = applyLayoutHack();
    expect(state?.targetDiv).toBe(container);
    expect(container.style.height).toBe('calc(100vh - 4px)');
    expect(container.style.display).toBe('flex');
    expect(container.style.flexDirection).toBe('column');
  });

  it('applies the same values when the host already has the newer CompasLayout inline styles', () => {
    const container = mountLayoutContainer({
      existingStyles: {
        height: 'calc(100vh - 4px)',
        display: 'flex',
        flexDirection: 'column',
      },
    });
    const state = applyLayoutHack();
    expect(state?.originalStyles).toEqual({
      height: 'calc(100vh - 4px)',
      display: 'flex',
      flexDirection: 'column',
    });
    expect(container.style.height).toBe('calc(100vh - 4px)');
    expect(container.style.display).toBe('flex');
    expect(container.style.flexDirection).toBe('column');
  });
});

describe('restoreLayoutHack', () => {
  it('does nothing when state is missing', () => {
    expect(() => restoreLayoutHack(null)).not.toThrow();
    expect(() => restoreLayoutHack(undefined)).not.toThrow();
  });

  it('restores original inline styles from an older CompasLayout', () => {
    const container = mountLayoutContainer();
    const state = applyLayoutHack();
    restoreLayoutHack(state);
    expect(container.style.height).toBe('');
    expect(container.style.display).toBe('');
    expect(container.style.flexDirection).toBe('');
  });

  it('restores the newer CompasLayout inline styles that were already present', () => {
    const container = mountLayoutContainer({
      existingStyles: {
        height: 'calc(100vh - 4px)',
        display: 'flex',
        flexDirection: 'column',
      },
    });
    const state = applyLayoutHack();
    restoreLayoutHack(state);
    expect(container.style.height).toBe('calc(100vh - 4px)');
    expect(container.style.display).toBe('flex');
    expect(container.style.flexDirection).toBe('column');
  });
});

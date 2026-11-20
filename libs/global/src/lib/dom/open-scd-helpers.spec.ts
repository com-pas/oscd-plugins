import { describe, it, expect, afterEach } from 'vitest';
import { getLayout, getOpenSCDHost } from './open-scd-helpers';

afterEach(() => {
  document.body.replaceChildren();
});

describe('getOpenSCDHost', () => {
  it('returns null when no open-scd element exists', () => {
    expect(getOpenSCDHost()).toBeNull();
  });

  it('returns the open-scd element when present', () => {
    const host = document.createElement('open-scd');
    document.body.appendChild(host);
    expect(getOpenSCDHost()).toBe(host);
  });
});

describe('getLayout', () => {
  it('returns null when host has no shadow root', () => {
    document.body.appendChild(document.createElement('open-scd'));
    expect(getLayout()).toBeNull();
  });

  it('returns null when the host shadow root has no layout element', () => {
    const host = document.createElement('open-scd');
    host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);
    expect(getLayout()).toBeNull();
  });

  it('returns compas-layout from the host shadow root', () => {
    const host = document.createElement('open-scd');
    const shadow = host.attachShadow({ mode: 'open' });
    const layout = document.createElement('compas-layout');
    shadow.appendChild(layout);
    document.body.appendChild(host);
    expect(getLayout()).toBe(layout);
  });

  it('returns oscd-layout when compas-layout is absent', () => {
    const host = document.createElement('open-scd');
    const shadow = host.attachShadow({ mode: 'open' });
    const layout = document.createElement('oscd-layout');
    shadow.appendChild(layout);
    document.body.appendChild(host);
    expect(getLayout()).toBe(layout);
  });
});

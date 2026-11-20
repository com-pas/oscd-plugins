import { describe, expect, it } from 'vitest';
import {
  fakeHostProps,
  notifyFakeHost,
  subscribeFakeHost,
} from './fake-host-props';

describe('fakeHostProps', () => {
  it('runs a subscriber immediately and again on notify', () => {
    const start = fakeHostProps.editCount;
    const seen: number[] = [];
    const stop = subscribeFakeHost(() => {
      seen.push(fakeHostProps.editCount);
    });

    fakeHostProps.editCount = start + 1;
    notifyFakeHost();
    stop();

    fakeHostProps.editCount = start + 2;
    notifyFakeHost();

    expect(seen).toEqual([start, start + 1]);
    fakeHostProps.editCount = start;
  });
});

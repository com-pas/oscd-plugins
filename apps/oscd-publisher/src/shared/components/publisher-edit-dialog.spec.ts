import { describe, expect, it } from 'vitest';

import { editDialogEnterSaves } from './publisher-edit-dialog.js';

function node(name: string): Element {
  return document.createElement(name);
}

describe('edit dialog Enter', () => {
  it('saves from a text field and from the dialog surface', () => {
    expect(
      editDialogEnterSaves([
        node('input'),
        node('md-outlined-text-field'),
        node('publisher-text-field'),
      ]),
    ).toBe(true);
    expect(editDialogEnterSaves([node('h3'), node('md-dialog')])).toBe(true);
  });

  it('leaves Enter to select, checkbox, radio, lock, and the action buttons', () => {
    expect(editDialogEnterSaves([node('md-checkbox'), node('publisher-checkbox')])).toBe(false);
    expect(editDialogEnterSaves([node('md-radio'), node('publisher-radio')])).toBe(false);
    expect(editDialogEnterSaves([node('md-outlined-select'), node('publisher-select')])).toBe(false);
    expect(editDialogEnterSaves([node('md-menu-item'), node('md-menu')])).toBe(false);
    expect(editDialogEnterSaves([node('button'), node('publisher-text-field')])).toBe(false);
    expect(editDialogEnterSaves([node('md-filled-button')])).toBe(false);
    expect(editDialogEnterSaves([node('md-outlined-button')])).toBe(false);
  });
});

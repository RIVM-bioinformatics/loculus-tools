import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  isEditorKeyTarget,
  keyToEditorCommand,
} from './keyboard';

describe('keyToEditorCommand', () => {
  it('maps nucleotide editing and navigation keys', () => {
    expect(keyToEditorCommand({ altKey: false, ctrlKey: false, key: 'n', metaKey: false, shiftKey: false })).toEqual({ base: 'N', type: 'mutate' });
    expect(keyToEditorCommand({ altKey: false, ctrlKey: false, key: 'ArrowRight', metaKey: false, shiftKey: true })).toEqual({ direction: 'right', extend: true, type: 'move' });
    expect(keyToEditorCommand({ altKey: false, ctrlKey: false, key: 'Delete', metaKey: false, shiftKey: false })).toEqual({ type: 'deleteGap' });
  });

  it('maps history and horizontal movement shortcuts', () => {
    expect(keyToEditorCommand({ altKey: false, ctrlKey: true, key: 'z', metaKey: false, shiftKey: true })).toEqual({ type: 'redo' });
    expect(keyToEditorCommand({ altKey: true, ctrlKey: false, key: 'ArrowLeft', metaKey: false, shiftKey: false })).toEqual({ direction: 'left', type: 'moveHorizontal' });
    expect(keyToEditorCommand({ altKey: false, ctrlKey: false, key: 'q', metaKey: false, shiftKey: false })).toBeNull();
  });
});

describe('isEditorKeyTarget', () => {
  it('leaves form and dialog keyboard ownership alone', () => {
    const input = document.createElement('input');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.append(input);

    expect(isEditorKeyTarget(input)).toBe(true);
    expect(isEditorKeyTarget(dialog)).toBe(true);
    expect(isEditorKeyTarget(document.createElement('div'))).toBe(false);
  });
});

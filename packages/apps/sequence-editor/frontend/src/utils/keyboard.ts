export type EditorCommand =
  | { base: string; type: 'mutate' }
  | { direction: 'down' | 'left' | 'right' | 'up'; extend: boolean; type: 'move' }
  | { direction: 'down' | 'up'; type: 'moveRows' }
  | { direction: 'left' | 'right'; type: 'moveHorizontal' }
  | { type: 'backspace' }
  | { type: 'deleteGap' }
  | { type: 'end' }
  | { type: 'home' }
  | { type: 'insert' }
  | { type: 'pageDown' }
  | { type: 'pageUp' }
  | { type: 'redo' }
  | { type: 'undo' };

const IUPAC_KEYS = new Set('ACGTURYKMSWBDHVN');

export const isEditorKeyTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.matches('input, textarea, select, [contenteditable="true"]')
    || Boolean(target.closest('[role="dialog"]'));
};

export const keyToEditorCommand = (event: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'>): EditorCommand | null => {
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === 'z') {
    return event.shiftKey ? { type: 'redo' } : { type: 'undo' };
  }
  if (modifier && event.key.toLowerCase() === 'y') {
    return { type: 'redo' };
  }
  if (modifier && event.key === 'ArrowDown') {
    return { direction: 'down', type: 'moveRows' };
  }
  if (modifier && event.key === 'ArrowUp') {
    return { direction: 'up', type: 'moveRows' };
  }
  if (event.altKey && event.key === 'ArrowLeft') {
    return { direction: 'left', type: 'moveHorizontal' };
  }
  if (event.altKey && event.key === 'ArrowRight') {
    return { direction: 'right', type: 'moveHorizontal' };
  }

  switch (event.key) {
    case ' ':
      return { type: 'insert' };
    case '-':
    case 'Delete':
      return { type: 'deleteGap' };
    case 'ArrowDown':
      return { direction: 'down', extend: false, type: 'move' };
    case 'ArrowLeft':
      return { direction: 'left', extend: event.shiftKey, type: 'move' };
    case 'ArrowRight':
      return { direction: 'right', extend: event.shiftKey, type: 'move' };
    case 'ArrowUp':
      return { direction: 'up', extend: false, type: 'move' };
    case 'Backspace':
      return { type: 'backspace' };
    case 'End':
      return { type: 'end' };
    case 'Home':
      return { type: 'home' };
    case 'PageDown':
      return { type: 'pageDown' };
    case 'PageUp':
      return { type: 'pageUp' };
    default: {
      const base = event.key.toUpperCase();
      return IUPAC_KEYS.has(base) && !modifier && !event.altKey
        ? { base, type: 'mutate' }
        : null;
    }
  }
};

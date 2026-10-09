import type { KeyboardShortcutConfig } from '@gen-epix/ui-core/classes/services/KeyboardShortcutService';

import { SequenceEditorEventBusService } from '../classes/services/SequenceEditorEventBusService';
import { EDITOR_DIRECTION } from '../models/editor';


type KeyboardShortcut = {
  callback: KeyboardShortcutConfig['callback'];
  description: string;
  shortcut: Pick<KeyboardShortcutConfig, 'code' | 'key' | 'modifiers'>;
};

const emitDirection = (eventName: 'onExpandSelection' | 'onMoveCells' | 'onMoveRows' | 'onMoveRowsEnd' | 'onMoveSelection', direction: EDITOR_DIRECTION): KeyboardShortcutConfig['callback'] => (event) => {
  event.preventDefault();
  SequenceEditorEventBusService.getInstance().emit(eventName, direction);
};

const emitVoid = (eventName: 'onDeleteBackward' | 'onGotoPosition' | 'onInsert' | 'onRedo' | 'onScrollPageDown' | 'onScrollPageUp' | 'onScrollToLineEnd' | 'onScrollToLineStart' | 'onUndo'): KeyboardShortcutConfig['callback'] => (event) => {
  event.preventDefault();
  SequenceEditorEventBusService.getInstance().emit(eventName);
};

const emitMutateSelection = (base: string): KeyboardShortcutConfig['callback'] => (event) => {
  event.preventDefault();
  SequenceEditorEventBusService.getInstance().emit('onMutateSelection', base);
};

export const KEYBOARD_SHORTCUTS: { [key: string]: KeyboardShortcut } = {
  deleteBackward: {
    callback: emitVoid('onDeleteBackward'),
    description: 'Delete backward',
    shortcut: { code: 'Backspace' },
  },
  deleteBase: {
    callback: emitMutateSelection('-'),
    description: 'Delete base',
    shortcut: { key: '-' },
  },
  deleteSelection: {
    callback: emitMutateSelection('-'),
    description: 'Delete selection',
    shortcut: { code: 'Delete' },
  },
  expandSelectionDown: {
    callback: emitDirection('onExpandSelection', EDITOR_DIRECTION.DOWN),
    description: 'Expand selection down',
    shortcut: { code: 'ArrowDown', modifiers: [['Shift']] },
  },
  expandSelectionLeft: {
    callback: emitDirection('onExpandSelection', EDITOR_DIRECTION.LEFT),
    description: 'Expand selection left',
    shortcut: { code: 'ArrowLeft', modifiers: [['Shift']] },
  },
  expandSelectionRight: {
    callback: emitDirection('onExpandSelection', EDITOR_DIRECTION.RIGHT),
    description: 'Expand selection right',
    shortcut: { code: 'ArrowRight', modifiers: [['Shift']] },
  },
  expandSelectionUp: {
    callback: emitDirection('onExpandSelection', EDITOR_DIRECTION.UP),
    description: 'Expand selection up',
    shortcut: { code: 'ArrowUp', modifiers: [['Shift']] },
  },
  gotoPosition: {
    callback: emitVoid('onGotoPosition'),
    description: 'Go to position',
    shortcut: { key: 'g', modifiers: [['Meta'], ['Control']] },
  },
  insertGap: {
    callback: emitVoid('onInsert'),
    description: 'Insert gap',
    shortcut: { code: 'Space' },
  },
  moveCellLeft: {
    callback: emitDirection('onMoveCells', EDITOR_DIRECTION.LEFT),
    description: 'Move cell left',
    shortcut: { code: 'ArrowLeft', modifiers: [['Alt']] },
  },
  moveCellRight: {
    callback: emitDirection('onMoveCells', EDITOR_DIRECTION.RIGHT),
    description: 'Move cell right',
    shortcut: { code: 'ArrowRight', modifiers: [['Alt']] },
  },
  moveRowDown: {
    callback: emitDirection('onMoveRows', EDITOR_DIRECTION.DOWN),
    description: 'Move row down',
    shortcut: { code: 'ArrowDown', modifiers: [['Control'], ['Meta']] },
  },
  moveRowToEnd: {
    callback: emitDirection('onMoveRowsEnd', EDITOR_DIRECTION.DOWN),
    description: 'Move row to end',
    shortcut: { code: 'ArrowDown', modifiers: [['Alt']] },
  },
  moveRowToStart: {
    callback: emitDirection('onMoveRowsEnd', EDITOR_DIRECTION.UP),
    description: 'Move row to start',
    shortcut: { code: 'ArrowUp', modifiers: [['Alt']] },
  },
  moveRowUp: {
    callback: emitDirection('onMoveRows', EDITOR_DIRECTION.UP),
    description: 'Move row up',
    shortcut: { code: 'ArrowUp', modifiers: [['Control'], ['Meta']] },
  },
  moveSelectionDown: {
    callback: emitDirection('onMoveSelection', EDITOR_DIRECTION.DOWN),
    description: 'Move selection down',
    shortcut: { code: 'ArrowDown' },
  },
  moveSelectionLeft: {
    callback: emitDirection('onMoveSelection', EDITOR_DIRECTION.LEFT),
    description: 'Move selection left',
    shortcut: { code: 'ArrowLeft' },
  },
  moveSelectionRight: {
    callback: emitDirection('onMoveSelection', EDITOR_DIRECTION.RIGHT),
    description: 'Move selection right',
    shortcut: { code: 'ArrowRight' },
  },
  moveSelectionUp: {
    callback: emitDirection('onMoveSelection', EDITOR_DIRECTION.UP),
    description: 'Move selection up',
    shortcut: { code: 'ArrowUp' },
  },
  redo: {
    callback: emitVoid('onRedo'),
    description: 'Redo',
    shortcut: { key: 'z', modifiers: [['Meta', 'Shift'], ['Control', 'Shift']] },
  },
  scrollPageDown: {
    callback: emitVoid('onScrollPageDown'),
    description: 'Scroll page down',
    shortcut: { code: 'PageDown' },
  },
  scrollPageUp: {
    callback: emitVoid('onScrollPageUp'),
    description: 'Scroll page up',
    shortcut: { code: 'PageUp' },
  },
  scrollToLineEnd: {
    callback: emitVoid('onScrollToLineEnd'),
    description: 'Scroll to line end',
    shortcut: { code: 'End' },
  },
  scrollToLineStart: {
    callback: emitVoid('onScrollToLineStart'),
    description: 'Scroll to line start',
    shortcut: { code: 'Home' },
  },
  undo: {
    callback: emitVoid('onUndo'),
    description: 'Undo',
    shortcut: { key: 'z', modifiers: [['Meta'], ['Control']] },
  },
};

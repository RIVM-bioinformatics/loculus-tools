import {
  Box,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import {
  KeyboardArrowDown,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  KeyboardArrowUp,
  KeyboardCommandKey,
  KeyboardControlKey,
  KeyboardOptionKey,
  SpaceBar,
} from '@mui/icons-material';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import type {
  ComponentType,
  MouseEvent as ReactMouseEvent,
} from 'react';
import type { KeyboardModifier } from '@gen-epix/ui-core/classes/services/KeyboardShortcutService';

import { KEYBOARD_SHORTCUTS } from '../../../constants';

type ShortcutKey = {
  icon?: ComponentType<SvgIconProps>;
  label: string;
};

const MODIFIER_LABELS = new Map<KeyboardModifier, string>([
  ['Alt', 'Alt'],
  ['AltGraph', 'AltGr'],
  ['Control', 'Ctrl'],
  ['Meta', 'Cmd'],
  ['Shift', 'Shift'],
]);

const MODIFIER_ICONS = new Map<KeyboardModifier, ComponentType<SvgIconProps>>([
  ['Alt', KeyboardOptionKey],
  ['Control', KeyboardControlKey],
  ['Meta', KeyboardCommandKey],
]);

const CODE_KEYS = new Map<string, ShortcutKey>([
  ['ArrowDown', { icon: KeyboardArrowDown, label: 'Arrow down' }],
  ['ArrowLeft', { icon: KeyboardArrowLeft, label: 'Arrow left' }],
  ['ArrowRight', { icon: KeyboardArrowRight, label: 'Arrow right' }],
  ['ArrowUp', { icon: KeyboardArrowUp, label: 'Arrow up' }],
  ['Backspace', { label: 'Backspace' }],
  ['Delete', { label: 'Delete' }],
  ['End', { label: 'End' }],
  ['Home', { label: 'Home' }],
  ['PageDown', { label: 'Page down' }],
  ['PageUp', { label: 'Page up' }],
  ['Space', { icon: SpaceBar, label: 'Space' }],
]);

type Shortcut = typeof KEYBOARD_SHORTCUTS[string];

type ShortcutGroup = {
  name: string;
  shortcuts: Shortcut[];
};

const isMacOs = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    name: 'Selection',
    shortcuts: [
      KEYBOARD_SHORTCUTS.moveSelectionLeft,
      KEYBOARD_SHORTCUTS.moveSelectionRight,
      KEYBOARD_SHORTCUTS.moveSelectionUp,
      KEYBOARD_SHORTCUTS.moveSelectionDown,
      KEYBOARD_SHORTCUTS.expandSelectionLeft,
      KEYBOARD_SHORTCUTS.expandSelectionRight,
      KEYBOARD_SHORTCUTS.expandSelectionUp,
      KEYBOARD_SHORTCUTS.expandSelectionDown,
      KEYBOARD_SHORTCUTS.moveCellLeft,
      KEYBOARD_SHORTCUTS.moveCellRight,
    ],
  },
  {
    name: 'Rows',
    shortcuts: [
      KEYBOARD_SHORTCUTS.moveRowUp,
      KEYBOARD_SHORTCUTS.moveRowDown,
      KEYBOARD_SHORTCUTS.moveRowToStart,
      KEYBOARD_SHORTCUTS.moveRowToEnd,
    ],
  },
  {
    name: 'Navigation',
    shortcuts: [
      KEYBOARD_SHORTCUTS.scrollToLineStart,
      KEYBOARD_SHORTCUTS.scrollToLineEnd,
      KEYBOARD_SHORTCUTS.scrollPageUp,
      KEYBOARD_SHORTCUTS.scrollPageDown,
      KEYBOARD_SHORTCUTS.gotoPosition,
    ],
  },
  {
    name: 'Editing',
    shortcuts: [
      KEYBOARD_SHORTCUTS.insertGap,
      KEYBOARD_SHORTCUTS.deleteBackward,
      KEYBOARD_SHORTCUTS.deleteSelection,
      KEYBOARD_SHORTCUTS.deleteBase,
      KEYBOARD_SHORTCUTS.undo,
      KEYBOARD_SHORTCUTS.redo,
    ],
  },
];

const getActiveModifierGroup = (modifierGroups: KeyboardModifier[][]): KeyboardModifier[] => {
  const preferredModifier = isMacOs ? 'Meta' : 'Control';
  return modifierGroups.find((modifierGroup) => modifierGroup.includes(preferredModifier)) ?? modifierGroups[0] ?? [];
};

const getShortcutKeys = (shortcut: Shortcut): ShortcutKey[] => {
  const { code, key, modifiers = [] } = shortcut.shortcut;
  const keyLabel = code ? (CODE_KEYS.get(code) ?? { label: code }) : { label: key?.toUpperCase() ?? '' };
  const modifierGroup = getActiveModifierGroup(modifiers);
  return [
    ...modifierGroup.map((modifier) => ({
      icon: MODIFIER_ICONS.get(modifier),
      label: isMacOs && modifier === 'Alt' ? 'Option' : MODIFIER_LABELS.get(modifier) ?? modifier,
    })),
    keyLabel,
  ];
};

const renderShortcutKeys = (shortcut: Shortcut) => {
  const keyGroups = getShortcutKeys(shortcut);

  return (
    <Box
      aria-label={keyGroups.map(({ label }) => label).join(' ')}
      sx={{ alignItems: 'center', display: 'flex', flexShrink: 0, gap: 0.5 }}
    >
      <Box sx={{ alignItems: 'center', display: 'flex', gap: 0.5 }}>
        {keyGroups.map((keyItem) => {
          const KeyIcon = keyItem.icon;
          return (
            <Box
              aria-label={keyItem.label}
              component={'kbd'}
              key={keyItem.label}
              sx={{
                alignItems: 'center',
                backgroundColor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 0.75,
                boxShadow: '0 1px 0 rgba(0, 0, 0, 0.2)',
                color: 'text.primary',
                display: 'flex',
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                justifyContent: 'center',
                lineHeight: 1,
                minWidth: keyItem.label.length === 1 ? 24 : 'auto',
                px: 0.75,
                py: 0.5,
                textAlign: 'center',
              }}
            >
              {KeyIcon ? (
                <KeyIcon
                  aria-hidden
                  fontSize={'inherit'}
                />
              ) : keyItem.label}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

const onClickShortcut = (event: ReactMouseEvent<HTMLElement>) => {
  const shortcut = Object.values(KEYBOARD_SHORTCUTS).find(({ description }) => description === event.currentTarget.dataset.shortcut);
  if (!shortcut) {
    return;
  }

  const { code, key, modifiers = [] } = shortcut.shortcut;
  const activeModifiers = getActiveModifierGroup(modifiers);
  shortcut.callback(new KeyboardEvent('keydown', {
    altKey: activeModifiers.includes('Alt'),
    code: code ?? '',
    ctrlKey: activeModifiers.includes('Control'),
    key: key ?? code ?? '',
    metaKey: activeModifiers.includes('Meta'),
    shiftKey: activeModifiers.includes('Shift'),
  }));
};

export const SequenceEditorPageDrawerKeyboardShortcuts = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: 2, py: 2.5 }}>
    {SHORTCUT_GROUPS.map((group) => (
      <Box key={group.name}>
        <Typography
          sx={{ color: 'text.secondary', fontWeight: 700, mb: 0.5, textTransform: 'uppercase' }}
          variant={'caption'}
        >
          {group.name}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {group.shortcuts.map((shortcut) => (
            <ListItemButton
              data-shortcut={shortcut.description}
              key={shortcut.description}
              onClick={onClickShortcut}
              sx={{ borderRadius: 1, gap: 1, justifyContent: 'space-between', px: 1, py: 0.75 }}
            >
              <ListItemText
                primary={shortcut.description}
                sx={{ '& .MuiListItemText-primary': { typography: 'body2' } }}
              />
              {renderShortcutKeys(shortcut)}
            </ListItemButton>
          ))}
        </Box>
      </Box>
    ))}
  </Box>
);

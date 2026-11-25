import type { MenuItemData } from '@gen-epix/ui-core-components/models/nested-menu.models';
import { NestedDropdown } from '@gen-epix/ui-core-components/components/NestedMenu';
import { container } from 'tsyringe';
import { useMemo } from 'react';
import { Box } from '@mui/material';
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
import type { SxProps } from '@mui/material';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import type { ComponentType } from 'react';
import type { KeyboardModifier } from '@gen-epix/ui-core/classes/services/KeyboardShortcutService';

import { SequenceEditorEventBusService } from '../../../classes/services/SequenceEditorEventBusService';
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

const isMacOs = typeof navigator !== 'undefined' && /^(Mac|iPhone|iPad|iPod)/i.test(
  (navigator as { userAgentData?: { platform?: string } } & Navigator).userAgentData?.platform ?? navigator.platform,
);

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
              fontSize: '0.5rem',
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
  );
};

const createShortcutItem = (shortcut: Shortcut, divider = false): MenuItemData => {
  const { code, key, modifiers = [] } = shortcut.shortcut;
  const activeModifiers = getActiveModifierGroup(modifiers);

  return {
    callback: () => shortcut.callback(new KeyboardEvent('keydown', {
      altKey: activeModifiers.includes('Alt'),
      code: code ?? '',
      ctrlKey: activeModifiers.includes('Control'),
      key: key ?? code ?? '',
      metaKey: activeModifiers.includes('Meta'),
      shiftKey: activeModifiers.includes('Shift'),
    })),
    divider,
    label: shortcut.description,
    rightIcon: renderShortcutKeys(shortcut),
  };
};

const createOsSpecificShortcutItems = (...shortcuts: Shortcut[]): MenuItemData[] => shortcuts
  .filter(shortcut => (!shortcut.macOnly || isMacOs) && (!shortcut.nonMacOnly || !isMacOs))
  .map(shortcut => createShortcutItem(shortcut));

export const SequenceEditorMenu = () => {
  const subItemSx = useMemo<SxProps>(() => ({
    width: '350px',
  }), []);

  const menuData = useMemo<MenuItemData[]>(() => {
    return ([
      {
        items: [
          createShortcutItem(KEYBOARD_SHORTCUTS.undo),
          createShortcutItem(KEYBOARD_SHORTCUTS.redo, true),
          createShortcutItem(KEYBOARD_SHORTCUTS.copySelection),
          createShortcutItem(KEYBOARD_SHORTCUTS.pasteFasta, true),
          ...createOsSpecificShortcutItems(
            KEYBOARD_SHORTCUTS.deleteRows,
            KEYBOARD_SHORTCUTS.deleteRowsMac,
          ),
        ],
        label: 'Edit',
      },
      {
        items: [
          createShortcutItem(KEYBOARD_SHORTCUTS.moveSelectionLeft),
          createShortcutItem(KEYBOARD_SHORTCUTS.moveSelectionRight),
          createShortcutItem(KEYBOARD_SHORTCUTS.moveSelectionUp),
          createShortcutItem(KEYBOARD_SHORTCUTS.moveSelectionDown, true),

          createShortcutItem(KEYBOARD_SHORTCUTS.expandSelectionRight),
          createShortcutItem(KEYBOARD_SHORTCUTS.expandSelectionLeft),
          createShortcutItem(KEYBOARD_SHORTCUTS.expandSelectionDown),
          createShortcutItem(KEYBOARD_SHORTCUTS.expandSelectionUp, true),

          createShortcutItem(KEYBOARD_SHORTCUTS.moveCellLeft),
          createShortcutItem(KEYBOARD_SHORTCUTS.moveCellRight, true),

          createShortcutItem(KEYBOARD_SHORTCUTS.moveRowUp),
          createShortcutItem(KEYBOARD_SHORTCUTS.moveRowDown),
          createShortcutItem(KEYBOARD_SHORTCUTS.moveRowToStart),
          createShortcutItem(KEYBOARD_SHORTCUTS.moveRowToEnd, true),
        ],
        label: 'Selection',
      },
      {
        items: [
          createShortcutItem(KEYBOARD_SHORTCUTS.scrollToLineStart),
          createShortcutItem(KEYBOARD_SHORTCUTS.scrollToLineEnd),
          createShortcutItem(KEYBOARD_SHORTCUTS.scrollPageUp),
          createShortcutItem(KEYBOARD_SHORTCUTS.scrollPageDown, true),
          createShortcutItem(KEYBOARD_SHORTCUTS.gotoPosition),
        ],
        label: 'View',
      },
      {
        items: [
          {
            callback: () => container.resolve(SequenceEditorEventBusService).emit('onRealign'),
            divider: true,
            label: 'Re-align all sequences',
          },
          createShortcutItem(KEYBOARD_SHORTCUTS.insertGap),
          createShortcutItem(KEYBOARD_SHORTCUTS.deleteBackward),
          createShortcutItem(KEYBOARD_SHORTCUTS.deleteSelection),
          createShortcutItem(KEYBOARD_SHORTCUTS.deleteBase),
        ],
        label: 'Align',
      },
    ] satisfies MenuItemData[]).map(x => x.items ? { ...x, items: x.items.map(item => ({ ...item, sx: subItemSx })) } : x);
  }, [subItemSx]);

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
      }}
    >
      {menuData.map((item) => (
        <NestedDropdown
          ButtonProps={{
            color: 'primary',
            disabled: item.disabled,
            size: 'medium',
            variant: 'text',
          }}
          key={item.label}
          menuItemsData={item}
          MenuProps={{ elevation: 3 }}
        />
      ))}

    </Box>
  );
};

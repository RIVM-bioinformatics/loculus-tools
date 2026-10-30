import {
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  styled,
  useThemeProps,
} from '@mui/material';
import type { ButtonOwnProps } from '@mui/material';
import type {
  ComponentsOverrides,
  Theme,
} from '@mui/material/styles';
import {
  useCallback,
  useState,
} from 'react';
import type {
  MouseEvent,
  ReactElement,
} from 'react';

export type ButtonWithMenuProps = {
  buttonColor?: ButtonOwnProps['color'];
  disabled?: boolean;
  items: Array<{
    icon: ReactElement;
    label: string;
    onClick: () => void;
  }>;
  label: string;
  startIcon?: ReactElement;
};

export type ButtonWithMenuTheme = {
  styleOverrides?: ComponentsOverrides<Theme>['MuiButton'];
};

const ButtonWithMenuButton = styled(Button, {
  name: 'RivmLoculusToolsCommonFrontendButtonWithMenu',
  slot: 'Root',
})({
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  color: '#FFFFFF',
});

export const ButtonWithMenu = (inProps: ButtonWithMenuProps) => {
  const {
    buttonColor = 'inherit',
    disabled,
    items,
    label,
    startIcon,
  } = useThemeProps({ name: 'RivmLoculusToolsCommonFrontendButtonWithMenu', props: inProps });
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const isMenuOpen = Boolean(anchorElement);

  const onClickMenu = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    setAnchorElement(event.currentTarget);
  }, []);

  const onCloseMenu = useCallback(() => {
    setAnchorElement(null);
  }, []);

  return (
    <>
      <ButtonWithMenuButton
        color={buttonColor}
        disabled={disabled}
        onClick={onClickMenu}
        size={'small'}
        startIcon={startIcon}
        variant={'contained'}
      >
        {label}
      </ButtonWithMenuButton>
      <Menu
        anchorEl={anchorElement}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        onClose={onCloseMenu}
        open={isMenuOpen}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      >
        {items.map(({ icon, label: itemLabel, onClick }) => (
          <MenuItem
            key={itemLabel}
            // eslint-disable-next-line @eslint-react/kit/jsx-no-bind
            onClick={() => {
              onCloseMenu();
              onClick();
            }}
          >
            <ListItemIcon>
              {icon}
            </ListItemIcon>
            <ListItemText primary={itemLabel} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

import {
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  useCallback,
  useState,
} from 'react';
import type {
  MouseEvent,
  ReactElement,
} from 'react';

export type ButtonWithMenuProps = {
  disabled?: boolean;
  items: Array<{
    icon: ReactElement;
    label: string;
    onClick: () => void;
  }>;
  label: string;
  startIcon?: ReactElement;
};

export const ButtonWithMenu = ({ disabled, items, label, startIcon }: ButtonWithMenuProps) => {
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
      <Button
        color={'inherit'}
        disabled={disabled}
        onClick={onClickMenu}
        size={'small'}
        startIcon={startIcon}
        sx={{
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
          },
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          color: '#FFFFFF',
        }}
        variant={'contained'}
      >
        {label}
      </Button>
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

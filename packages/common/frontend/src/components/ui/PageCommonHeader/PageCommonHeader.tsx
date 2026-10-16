import type { ReactNode } from 'react';
import {
  use,
  useCallback,
} from 'react';
import {
  AppBar,
  Box,
  IconButton,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

import { PageCommonContext } from '../../../context/pageCommonContext';


export type PageCommonHeaderProps = {
  readonly centerComponent?: ReactNode;
  readonly icon?: ReactNode;
  readonly rightComponent?: ReactNode;
  readonly title: string;
};

export const PageCommonHeader = ({ centerComponent, icon, rightComponent, title }: PageCommonHeaderProps) => {
  const { isDrawerOpen, isNoInteraction, setIsDrawerOpen } = use(PageCommonContext);

  const onToggleDrawerButtonClick = useCallback(() => {
    setIsDrawerOpen(!isDrawerOpen);
  }, [isDrawerOpen, setIsDrawerOpen]);

  return (
    <AppBar
      elevation={1}
      position={'static'}
      sx={{
        backgroundColor: 'primary.main',
        color: '#FFFFFF',
        height: 56,
        justifyContent: 'center',
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar
        sx={{ display: 'flex', justifyContent: 'space-between', px: 2 }}
        variant={'dense'}
      >
        {/* Left: Menu toggle and App Branding */}
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1.5 }}>
          {!isNoInteraction && (
            <IconButton
              aria-label={'open drawer'}
              color={'inherit'}
              edge={'start'}
              onClick={onToggleDrawerButtonClick}
              size={'small'}
            >
              <MenuIcon />
            </IconButton>
          )}
          {icon && (
            <>
              {icon}
            </>
          )}
          <Typography
            component={'div'}
            noWrap
            sx={{ color: 'inherit', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.01em' }}
            variant={'h6'}
          >
            {title}
          </Typography>
          <Typography
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              borderRadius: 1,
              display: { sm: 'inline-block', xs: 'none' },
              fontSize: '0.7rem',
              fontWeight: 600,
              px: 1,
              py: 0.25,
            }}
            variant={'caption'}
          >
            {'Loculus Tool'}
          </Typography>
        </Box>
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
          {centerComponent}
        </Box>
        {!isNoInteraction && (
          <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
            {rightComponent}
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

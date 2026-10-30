import type { ReactNode } from 'react';
import {
  use,
  useCallback,
  useMemo,
} from 'react';
import {
  AppBar,
  Box,
  IconButton,
  Toolbar,
  Typography,
  useTheme,
  useThemeProps,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

import { PageCommonContext } from '../../../context/pageCommonContext';

export type PageCommonHeaderProps = {
  readonly centerComponent?: ReactNode;
  readonly rightComponent?: ReactNode;
  readonly title: string;
};

export interface PageCommonHeaderTheme {
  backgroundColor: string;
  color: string;
}

export const PageCommonHeader = (inProps: PageCommonHeaderProps) => {
  const { centerComponent, rightComponent, title } = useThemeProps({ name: 'RivmLoculusToolsCommonFrontendPageCommonHeader', props: inProps });
  const theme = useTheme();
  const pageCommonHeaderTheme = useMemo<PageCommonHeaderTheme>(() => ({
    ...{
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
    } satisfies PageCommonHeaderTheme,
    ...(theme.components?.RivmLoculusToolsCommonFrontendPageCommonHeader ?? {}),
  }), [theme]);


  const { afterAppBarComponent, afterAppBarRightComponent, appBarHeight = 48, appBarIcon, beforeAppBarComponent, beforeAppBarRightComponent, isDrawerOpen, isNoInteraction, setIsDrawerOpen } = use(PageCommonContext);

  const onToggleDrawerButtonClick = useCallback(() => {
    setIsDrawerOpen(!isDrawerOpen);
  }, [isDrawerOpen, setIsDrawerOpen]);

  return (
    <Box>
      {beforeAppBarComponent}
      <AppBar
        elevation={1}
        position={'static'}
        sx={{
          backgroundColor: pageCommonHeaderTheme.backgroundColor,
          color: pageCommonHeaderTheme.color,
          height: appBarHeight,
          justifyContent: 'center',
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            px: `${theme.spacing(1)} !important`, // using !important to override media queries
          }}
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
            {appBarIcon && (
              <>
                {appBarIcon}
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
          </Box>
          {!isNoInteraction && (
            <>
              <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                {centerComponent}
              </Box>
              <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                {beforeAppBarRightComponent && (
                  <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                    {beforeAppBarRightComponent}
                  </Box>
                )}
                <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                  {rightComponent}
                </Box>
                {afterAppBarRightComponent && (
                  <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                    {afterAppBarRightComponent}
                  </Box>
                )}
              </Box>
            </>
          )}
        </Toolbar>
      </AppBar>
      {afterAppBarComponent}
    </Box>
  );
};

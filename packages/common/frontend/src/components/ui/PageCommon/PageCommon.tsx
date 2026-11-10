import {
  Box,
  useTheme,
} from '@mui/material';
import {
  use,
  useEffect,
} from 'react';
import type { ReactNode } from 'react';

import { DRAWER_WIDTH } from '../../../constants/page.constants';
import { PageCommonContext } from '../../../context/pageCommonContext';
import { useUpdateDocumentTitle } from '../../../hooks/useUpdateDocumentTitle';
import { useConfig } from '../../../hooks/useConfig';

export type PageCommonProps = {
  readonly children: ReactNode;
  readonly isNoInteraction?: boolean;
  readonly title: string;
};


export const PageCommon = ({ children, isNoInteraction, title }: PageCommonProps) => {
  const { drawerComponent: DrawerComponent, headerComponent: HeaderComponent } = useConfig();

  useUpdateDocumentTitle(title);
  const theme = useTheme();
  const { drawerButtonId, drawerContainerId, isDrawerOpen, setIsDrawerOpen, setIsNoInteraction } = use(PageCommonContext);

  useEffect(() => {
    setIsNoInteraction(!!isNoInteraction);
  }, [isNoInteraction, setIsNoInteraction]);


  useEffect(() => {
    // when the focus is inside the drawer and the drawer is open, pressing Escape should close the drawer
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isDrawerOpen) {
        const drawer = document.getElementById(drawerContainerId);
        if (drawer?.contains(document.activeElement)) {
          setIsDrawerOpen(false);
          document.getElementById(drawerButtonId)?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerButtonId, drawerContainerId, isDrawerOpen, setIsDrawerOpen]);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateRows: HeaderComponent ? 'max-content auto' : 'auto',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        width: '100vw',
      }}
    >
      {HeaderComponent && <HeaderComponent />}
      <Box
        id={drawerContainerId}
        sx={{
          display: 'flex',
          flex: 1,
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
        }}
      >
        {DrawerComponent && <DrawerComponent />}
        <Box
          component={'main'}
          sx={{
            flexGrow: 1,
            height: '100%',
            marginLeft: isDrawerOpen ? `${DRAWER_WIDTH}px` : 0,
            overflow: 'hidden',
            position: 'relative',
            transition: () =>
              theme.transitions.create(['margin', 'width'], {
                duration: theme.transitions.duration.leavingScreen,
                easing: theme.transitions.easing.sharp,
              }),
            width: isDrawerOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
          }}
        >
          {children}
        </Box>

      </Box>
    </Box>
  );
};

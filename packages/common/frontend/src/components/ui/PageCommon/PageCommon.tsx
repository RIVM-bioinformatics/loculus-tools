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
  const { drawerComponent, headerComponent } = useConfig();
  useUpdateDocumentTitle(title);
  const theme = useTheme();
  const { isDrawerOpen, setIsNoInteraction } = use(PageCommonContext);

  useEffect(() => {
    setIsNoInteraction(!!isNoInteraction);
  }, [isNoInteraction, setIsNoInteraction]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        width: '100vw',
      }}
    >
      {headerComponent}
      {/* Main Body */}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          height: 'calc(100vh - 56px)',
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
        }}
      >
        {drawerComponent}
        <Box
          component={'main'}
          sx={{
            flexGrow: 1,
            height: '100%',
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

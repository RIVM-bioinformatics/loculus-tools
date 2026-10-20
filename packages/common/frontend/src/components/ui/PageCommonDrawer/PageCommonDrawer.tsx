import { Drawer } from '@mui/material';
import { use } from 'react';
import type { ReactNode } from 'react';

import { DRAWER_WIDTH } from '../../../constants/page.constants';
import { PageCommonContext } from '../../../context/pageCommonContext';

export type PageCommonDrawerProps = {
  readonly children: ReactNode;
};

export const PageCommonDrawer = ({ children }: PageCommonDrawerProps) => {
  const { drawerContainerId, isDrawerOpen } = use(PageCommonContext);

  return (
    <Drawer
      anchor={'left'}
      ModalProps={{
        container: () => document.getElementById(drawerContainerId),
        style: { position: 'absolute' }, // Forces modal overlay to stay inside the container
      }}
      open={isDrawerOpen}
      sx={{
        '& .MuiDrawer-paper': {
          flexShrink: 0,
          height: '100%',
          overflowY: 'auto',
          position: 'absolute',
          width: isDrawerOpen ? DRAWER_WIDTH : 0,
        },
      }}
      variant={'persistent'}
    >
      {children}
    </Drawer>
  );
};

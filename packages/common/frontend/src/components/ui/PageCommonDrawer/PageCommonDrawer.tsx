import { Drawer } from '@mui/material';
import { use } from 'react';
import type { ReactNode } from 'react';

import { DRAWER_WIDTH } from '../../../constants/page.constants';
import { PageCommonContext } from '../../../context/pageCommonContext';

export type PageCommonDrawerProps = {
  readonly children: ReactNode;
};

export const PageCommonDrawer = ({ children }: PageCommonDrawerProps) => {
  const { isDrawerOpen } = use(PageCommonContext);

  return (
    <Drawer
      anchor={'left'}
      open={isDrawerOpen}
      sx={{
        '& .MuiDrawer-paper': {
          height: 'calc(100% - 56px)',
          overflowY: 'auto',
          top: '56px',
          width: DRAWER_WIDTH,
        },
        flexShrink: 0,
        width: isDrawerOpen ? DRAWER_WIDTH : 0,
      }}
      variant={'persistent'}
    >
      {children}
    </Drawer>
  );
};

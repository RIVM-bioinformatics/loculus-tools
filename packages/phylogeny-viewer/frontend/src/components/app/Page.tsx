import { Box } from '@mui/material';
import type { ReactNode } from 'react';

import { PageHeader } from './PageHeader';

export type PageProps = {
  readonly children: ReactNode;
  readonly drawerOpen: boolean;
  readonly noInteraction?: boolean;
};

export const Page = ({ children, drawerOpen, noInteraction }: PageProps) => {
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
      {/* Top Navigation */}
      <PageHeader
        drawerOpen={drawerOpen}
        noInteraction={noInteraction}
      />
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
        {children}
      </Box>
    </Box>
  );
};

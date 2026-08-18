import React from 'react';
import { Box } from '@mui/material';
import { AppHeader } from './AppHeader';
import { SideControlPanel, DRAWER_WIDTH } from '../drawer/SideControlPanel';
import { PhyloTreeView } from '../tree/PhyloTreeView';
import { DataImportModal } from '../dialogs/DataImportModal';
import { AlignmentErrorDialog } from '../dialogs/AlignmentErrorDialog';
import { LoadingOverlay } from '../common/LoadingOverlay';
import { useTreeViewStore } from '../../stores/treeViewStore';
import { useCalculationStore } from '../../stores/calculationStore';

export const AppLayout: React.FC = () => {
  const drawerOpen = useTreeViewStore((state) => state.drawerOpen);
  const calculationStatus = useCalculationStore((state) => state.status);
  const calculationEngine = useCalculationStore((state) => state.engine);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top Navigation */}
      <AppHeader />

      {/* Main Body */}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          height: 'calc(100vh - 56px)',
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Collapsible Sidebar */}
        <SideControlPanel />

        {/* Primary Viewport */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            height: '100%',
            width: drawerOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
            transition: (theme) =>
              theme.transitions.create(['margin', 'width'], {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.leavingScreen,
              }),
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <PhyloTreeView />
        </Box>
      </Box>

      {/* Global Overlays & Modals */}
      <DataImportModal />
      <AlignmentErrorDialog />

      {calculationStatus === 'loading' && (
        <LoadingOverlay
          message={`Computing Phylogenetic Tree (${calculationEngine === 'tn93' ? 'TN93 + NJ' : 'FastTree'})...`}
          subMessage="Executing WebAssembly bioinformatics engine in browser worker"
        />
      )}
    </Box>
  );
};

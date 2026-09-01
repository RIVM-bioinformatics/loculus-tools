import { Box } from '@mui/material';

import { SideControlPanel } from '../drawer/SideControlPanel';
import { DRAWER_WIDTH } from '../../constants/drawer';
import { PhyloTreeView } from '../tree/PhyloTreeView';
import { DataImportModal } from '../dialogs/DataImportModal';
import { AlignmentErrorDialog } from '../dialogs/AlignmentErrorDialog';
import { LoadingOverlay } from '../common/LoadingOverlay';
import { useTreeViewStore } from '../../stores/treeViewStore';
import { useCalculationStore } from '../../stores/calculationStore';

import { AppHeader } from './AppHeader';

export const AppLayout = () => {
  const drawerOpen = useTreeViewStore((state) => state.drawerOpen);
  const calculationStatus = useCalculationStore((state) => state.status);
  const calculationEngine = useCalculationStore((state) => state.engine);

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
      <AppHeader />
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
        {/* Collapsible Sidebar */}
        <SideControlPanel />
        {/* Primary Viewport */}
        <Box
          component={'main'}
          sx={{
            flexGrow: 1,
            height: '100%',
            overflow: 'hidden',
            position: 'relative',
            transition: (theme) =>
              theme.transitions.create(['margin', 'width'], {
                duration: theme.transitions.duration.leavingScreen,
                easing: theme.transitions.easing.sharp,
              }),
            width: drawerOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
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
          subMessage={'Executing WebAssembly bioinformatics engine in browser worker'}
        />
      )}
    </Box>
  );
};

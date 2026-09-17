import {
  Box,
  useTheme,
} from '@mui/material';
import { BackdropSpinner } from '@gen-epix/ui-core-components/components/BackdropSpinner';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useStore } from 'zustand';
import type { TreeNode } from '@gen-epix/ui-phylogenetic-tree/models/tree';
import { NewickUtil } from '@gen-epix/ui-phylogenetic-tree/utils/NewickUtil';

import { Page } from '../../app/Page';
import type { AlignmentErrorDialogRefMethods } from '../../dialogs/AlignmentErrorDialog';
import { AlignmentErrorDialog } from '../../dialogs/AlignmentErrorDialog';
import type { DataImportDialogRefMethods } from '../../dialogs/DataImportDialog';
import { DataImportDialog } from '../../dialogs/DataImportDialog';
import { PhyloTreeView } from '../../ui/PhyloTreeView';
import {
  DRAWER_WIDTH,
  LEGEND_WIDTH,
} from '../../../constants/view';
import { CALCULATION_STATUS } from '../../../models/calculation';
import { EventBusService } from '../../../classes/services/EventBusService';
import { useDeepLinking } from '../../../hooks/useDeepLinking';
import { SearchBar } from '../../ui/SearchBar';
import { SideControlPanel } from '../../ui/SideControlPanel';
import { Legend } from '../../ui/Legend/Legend';
import { uiStore } from '../../../stores/uiStore';
import { TreeNotLoaded } from '../../ui/TreeNotLoaded';


export const MainPage = () => {
  const newick = useStore(uiStore, (state) => state.newick);
  const colorByField = useStore(uiStore, (state) => state.colorByField);
  const dataImportDialogRef = useRef<DataImportDialogRefMethods>(null);
  const alignmentErrorDialogRef = useRef<AlignmentErrorDialogRefMethods>(null);
  const calculationStatus = useStore(uiStore, (state) => state.calculationStatus);
  const calculationEngine = useStore(uiStore, (state) => state.engine);
  const theme = useTheme();

  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  useEffect(() => {
    const eventBusService = EventBusService.getInstance();

    const removers = [
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onShowImportDialog', (message?: string) => {
        dataImportDialogRef.current?.open(message ? { initialErrorMessage: message } : undefined);
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onToggleDrawer', (isOpen: boolean) => {
        setIsDrawerOpen(isOpen);
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onShowAlignmentErrorDialog', () => {
        alignmentErrorDialogRef.current?.open();
      }),
    ];
    return () => {
      removers.forEach((remove) => remove());
    };
  }, []);

  useDeepLinking();

  // Parse Newick tree into TreeNode
  const parsedTree = useMemo<null | TreeNode>(() => {
    if (!newick?.trim()) {
      return null;
    }
    try {
      return NewickUtil.parse(newick.trim());
    } catch (e) {
      console.error('Failed to parse Newick tree', e);
      return null;
    }
  }, [newick]);

  // Extract leaf names in tree order
  const leafNames = useMemo<string[]>(() => {
    if (!parsedTree) {
      return [];
    }
    return NewickUtil.getSortedNames(parsedTree);
  }, [parsedTree]);


  const canShowTree = parsedTree !== null && leafNames.length > 0;

  return (
    <Page drawerOpen={isDrawerOpen}>
      <>
        {/* Collapsible Sidebar */}
        <SideControlPanel drawerOpen={isDrawerOpen} />
        {/* Primary Viewport */}
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
          {!canShowTree && <TreeNotLoaded />}
          {canShowTree && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateRows: 'max-content auto',
                height: '100%',
                position: 'relative',
                width: '100%',
              }}
            >
              <SearchBar />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: `auto ${colorByField ? `${LEGEND_WIDTH}px` : '0px'}`,
                  height: '100%',
                  position: 'relative',
                  width: '100%',
                }}
              >
                <PhyloTreeView newick={newick} />
                {colorByField && (
                  <Box
                    sx={{
                      borderTop: `1px solid ${theme.palette.divider}`,
                      height: '100%',
                    }}
                  >
                    <Legend />
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </Box>
        {/* Global Overlays & Modals */}
        <DataImportDialog ref={dataImportDialogRef} />
        <AlignmentErrorDialog ref={alignmentErrorDialogRef} />
        <BackdropSpinner
          label={`Computing phylogenetic tree (${calculationEngine === 'tn93' ? 'TN93 + NJ' : 'FastTree'})`}
          open={calculationStatus === CALCULATION_STATUS.LOADING}
        />
      </>
    </Page>
  );
};

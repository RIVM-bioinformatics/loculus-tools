import { Box } from '@mui/material';
import { BackdropSpinner } from '@gen-epix/ui-core-components/components/BackdropSpinner';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { useStore } from 'zustand';

import { Page } from '../components/app/Page';
import type { AlignmentErrorDialogRefMethods } from '../components/dialogs/AlignmentErrorDialog';
import { AlignmentErrorDialog } from '../components/dialogs/AlignmentErrorDialog';
import type { DataImportDialogRefMethods } from '../components/dialogs/DataImportDialog';
import { DataImportDialog } from '../components/dialogs/DataImportDialog';
import { SideControlPanel } from '../components/drawer/SideControlPanel';
import { PhyloTreeView } from '../components/tree/PhyloTreeView';
import { DRAWER_WIDTH } from '../constants/drawer';
import { CALCULATION_STATUS } from '../models/calculation';
import { EventBusService } from '../services/EventBusService';
import { calculationStore } from '../stores/calculationStore';
import { useDeepLinking } from '../hooks/useDeepLinking';
import { SearchFilter } from '../components/SearchFilter';


export const MainPage = () => {
  const dataImportDialogRef = useRef<DataImportDialogRefMethods>(null);
  const alignmentErrorDialogRef = useRef<AlignmentErrorDialogRefMethods>(null);
  const calculationStatus = useStore(calculationStore, (state) => state.status);
  const calculationEngine = useStore(calculationStore, (state) => state.engine);

  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  useEffect(() => {
    const eventBusService = EventBusService.getInstance();

    const removers = [
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onShowImportDialog', () => {
        dataImportDialogRef.current?.open();
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
            transition: (theme) =>
              theme.transitions.create(['margin', 'width'], {
                duration: theme.transitions.duration.leavingScreen,
                easing: theme.transitions.easing.sharp,
              }),
            width: isDrawerOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateRows: 'max-content auto',
              height: '100%',
              position: 'relative',
              width: '100%',
            }}
          >
            <SearchFilter />
            <PhyloTreeView />
          </Box>
        </Box>
        {/* Global Overlays & Modals */}
        <DataImportDialog ref={dataImportDialogRef} />
        <AlignmentErrorDialog ref={alignmentErrorDialogRef} />
        <BackdropSpinner
          backgroundColor={'rgba(0, 0, 0, 0.8)'}
          color={'primary'}
          label={`Computing Phylogenetic Tree (${calculationEngine === 'tn93' ? 'TN93 + NJ' : 'FastTree'})...`}
          open={calculationStatus === CALCULATION_STATUS.LOADING}
          textColor={'#fff'}
        />
      </>
    </Page>
  );
};

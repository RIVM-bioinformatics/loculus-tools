import { Box } from '@mui/material';
import { BackdropSpinner } from '@gen-epix/ui-core-components/components/BackdropSpinner';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

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
import { useCalculationStore } from '../stores/calculationStore';
import { useDatasetStore } from '../stores/datasetStore';
import { useMetadataStore } from '../stores/metadataStore';


export const MainPage = () => {
  const dataImportDialogRef = useRef<DataImportDialogRefMethods>(null);
  const alignmentErrorDialogRef = useRef<AlignmentErrorDialogRefMethods>(null);
  const calculationStatus = useCalculationStore((state) => state.status);
  const calculationEngine = useCalculationStore((state) => state.engine);

  const setFastaContent = useDatasetStore((state) => state.setFastaContent);
  const setMetadataContent = useDatasetStore((state) => state.setMetadataContent);
  const calculateTree = useCalculationStore((state) => state.calculateTree);
  const setColorByField = useMetadataStore((state) => state.setColorByField);

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
        console.log('Toggling drawer, isOpen:', isOpen);
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

  useEffect(() => {
    // Scan URL parameters for deep-linking
    const urlParams = new URLSearchParams(window.location.search);
    const inputFastaUrl = urlParams.get('input-fasta');
    const inputMetadataUrl = urlParams.get('input-metadata');

    const handleDeepLinking = async () => {
      if (inputFastaUrl) {
        try {
          console.log('[App] Auto-fetching FASTA from URL:', inputFastaUrl);
          const fastaRes = await fetch(inputFastaUrl);
          if (!fastaRes.ok) {
            throw new Error(`FASTA fetch failed (${fastaRes.status})`);
          }
          const fastaText = await fastaRes.text();

          const fastaResult = setFastaContent(fastaText);
          if (!fastaResult.isAligned) {
            return;
          }

          if (inputMetadataUrl) {
            try {
              console.log('[App] Auto-fetching Metadata from URL:', inputMetadataUrl);
              const metaRes = await fetch(inputMetadataUrl);
              if (metaRes.ok) {
                const metaText = await metaRes.text();
                const metaResult = setMetadataContent(metaText);
                if (metaResult.columns.length > 0) {
                  const preferred = metaResult.columns.find((c) =>
                    ['clade', 'country', 'division', 'host', 'lineage', 'region'].includes(c.toLowerCase())) || metaResult.columns[0];
                  if (preferred) {
                    const vals = metaResult.records.map((r) => r[preferred] || '');
                    const uniqueVals = Array.from(new Set(vals.filter(Boolean)));
                    setColorByField(preferred, uniqueVals, vals);
                  }
                }
              }
            } catch (metaErr) {
              console.warn('[App] Failed to auto-fetch metadata:', metaErr);
            }
          }

          // Automatically calculate initial tree
          await calculateTree(fastaText);
        } catch (fastaErr) {
          console.error('[App] Failed to auto-load FASTA:', fastaErr);
          EventBusService.getInstance().emit('onShowImportDialog');
        }
      } else {
        // PV1-02: Show data loading modal if no data provided via URL query params
        EventBusService.getInstance().emit('onShowImportDialog');
      }
    };

    void handleDeepLinking();
  }, [setFastaContent, setMetadataContent, calculateTree, setColorByField]);

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
          <PhyloTreeView />
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

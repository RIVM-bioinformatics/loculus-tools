import {
  Box,
  useTheme,
} from '@mui/material';
import { BackdropSpinner } from '@gen-epix/ui-core-components/components/BackdropSpinner';
import { ErrorUtil } from '@rivm-loculus-tools/frontend-common/utils/ErrorUtil';
import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useStore } from 'zustand';
import type { TreeNode } from '@gen-epix/ui-phylogenetic-tree/models/tree';
import { NewickUtil } from '@gen-epix/ui-phylogenetic-tree/utils/NewickUtil';
import { PageCommonContext } from '@rivm-loculus-tools/frontend-common/components/page';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import { UrlUtil } from '@rivm-loculus-tools/frontend-common/utils/UrlUtil';
import { FastaDataImportDialogLoader } from '@rivm-loculus-tools/frontend-common/components/FastaDataImportDialogLoader';
import { FastaDataEventBusService } from '@rivm-loculus-tools/frontend-common/classes/services/FastaDataEventBusService';
import { FastaNotLoaded } from '@rivm-loculus-tools/frontend-common/components/FastaNotLoaded';
import ForestOutlinedIcon from '@mui/icons-material/ForestOutlined';
import { CALCULATION_STATUS } from '@rivm-loculus-tools/frontend-common/models/fasta';

import { PhylogenyTreeView } from '../../ui/PhylogenyTreeView';
import { LEGEND_WIDTH } from '../../../constants/view';
import { EventBusService } from '../../../classes/services/EventBusService';
import { SearchBar } from '../../ui/SearchBar';
import { Legend } from '../../ui/Legend/Legend';
import { phylogenyViewerStore } from '../../../stores/phylogenyViewerStore';
import { PhylogenyViewerPage } from '../../ui/PhylogenyViewerPage';
import type { AlignmentErrorDialogRefMethods } from '../../ui/AlignmentErrorDialog';
import { AlignmentErrorDialog } from '../../ui/AlignmentErrorDialog';

export const PhylogenyViewerPageMainPage = () => {
  const newick = useStore(phylogenyViewerStore, (state) => state.newick);
  const colorByField = useStore(phylogenyViewerStore, (state) => state.colorByField);
  const calculationStatus = useStore(phylogenyViewerStore, (state) => state.calculationStatus);
  const calculationEngine = useStore(phylogenyViewerStore, (state) => state.engine);
  const setData = useStore(phylogenyViewerStore, (state) => state.setData);

  const alignmentErrorDialogRef = useRef<AlignmentErrorDialogRefMethods>(null);

  const theme = useTheme();

  const onClickLoadDemoData = useCallback(async () => {
    try {
      const [fastaRes, metaRes] = await Promise.all([
        fetch('/sample-data/sarscov2_aligned.fasta'),
        fetch('/sample-data/sarscov2_metadata.tsv'),
      ]);
      const demoFastaText = await fastaRes.text();
      const demoMetadataText = await metaRes.text();

      await setData(demoFastaText, demoMetadataText, 'country');
      FastaDataEventBusService.getInstance().emit('onCloseImportDialog');
    } catch (err: unknown) {
      FastaDataEventBusService.getInstance().emit('onCloseImportDialog');
      const errorMessage = `Failed to load demo dataset: ${ErrorUtil.getErrorMessage(err, 'Unknown error')}`;
      FastaDataEventBusService.getInstance().emit('onShowImportDialog', errorMessage);
    } finally {
      UrlUtil.clearSearchParams();
    }
  }, [setData]);

  const extraFastaDataImportDialogLoaderActions = useMemo<DialogAction[]>(() => [
    {
      autoFocus: true,
      color: 'secondary',
      label: 'Demo (SARS-CoV-2)',
      onClick: onClickLoadDemoData,
      variant: 'contained',
    },
  ], [onClickLoadDemoData]);

  const { setIsDrawerOpen } = use(PageCommonContext);

  useEffect(() => {
    const eventBusService = EventBusService.getInstance();

    const removers = [
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onToggleDrawer', (isOpen: boolean) => {
        setIsDrawerOpen(isOpen);
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      EventBusService.getInstance().addEventListener('onShowAlignmentErrorDialog', () => {
        alignmentErrorDialogRef.current?.open();
      }),
    ];
    return () => {
      removers.forEach((remove) => remove());
    };
  }, [setIsDrawerOpen]);

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
    <PhylogenyViewerPage
      isNoInteraction={false}
    >
      {!canShowTree && (
        <FastaNotLoaded
          description={'Load an aligned FASTA sequence file to automatically compute and render an interactive phylogenetic tree.'}
          icon={<ForestOutlinedIcon sx={{ color: 'text.disabled', fontSize: 72 }} />}
          title={'No Phylogenetic Tree Loaded'}
        />
      )}
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
            <PhylogenyTreeView newick={newick} />
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
      <AlignmentErrorDialog ref={alignmentErrorDialogRef} />
      <FastaDataImportDialogLoader
        extraActions={extraFastaDataImportDialogLoaderActions}
        store={phylogenyViewerStore}
      />
      <BackdropSpinner
        label={`Computing phylogenetic tree (${calculationEngine === 'tn93' ? 'TN93 + NJ' : 'FastTree'})`}
        open={calculationStatus === CALCULATION_STATUS.LOADING}
      />
    </PhylogenyViewerPage>
  );
};

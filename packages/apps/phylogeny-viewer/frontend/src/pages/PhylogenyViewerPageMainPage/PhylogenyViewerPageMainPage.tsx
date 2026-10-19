import { container } from 'tsyringe';
import {
  Box,
  useTheme,
} from '@mui/material';
import { BackdropSpinner } from '@gen-epix/ui-core-components/components/BackdropSpinner';
import {
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useStore } from 'zustand';
import type { TreeNode } from '@gen-epix/ui-phylogenetic-tree/models/tree.models';
import { NewickUtil } from '@gen-epix/ui-phylogenetic-tree/utils/NewickUtil';
import { FastaDataImportDialogLoader } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaDataImportDialogLoader';
import { FastaNotLoaded } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaNotLoaded';
import ForestOutlinedIcon from '@mui/icons-material/ForestOutlined';
import { LOADING_STATUS } from '@rivm-loculus-tools/common-frontend/models/fasta.models';
import { PageCommon } from '@rivm-loculus-tools/common-frontend/components/ui/PageCommon';
import { useConfig } from '@rivm-loculus-tools/common-frontend/hooks/useConfig';

import { PhylogenyTreeView } from '../../components/ui/PhylogenyTreeView';
import { LEGEND_WIDTH } from '../../constants/view';
import { PhylogenyViewerEventBusService } from '../../classes/services/PhylogenyViewerEventBusService';
import { PhylogenyViewerSearchBar } from '../../components/ui/PhylogenyViewerSearchBar';
import { Legend } from '../../components/ui/Legend';
import { phylogenyViewerStore } from '../../stores/phylogenyViewerStore';
import type { AlignmentErrorDialogRefMethods } from '../../components/ui/AlignmentErrorDialog';
import { AlignmentErrorDialog } from '../../components/ui/AlignmentErrorDialog';
import { CALCULATION_STATUS } from '../../models/calculation.models';
import type { PhylogenyViewerConfig } from '../../models/config.models';

export const PhylogenyViewerPageMainPage = () => {
  const config = useConfig<PhylogenyViewerConfig>();
  const newick = useStore(phylogenyViewerStore, (state) => state.newick);
  const colorByField = useStore(phylogenyViewerStore, (state) => state.colorByField);
  const calculationStatus = useStore(phylogenyViewerStore, (state) => state.calculationStatus);
  const loadingStatus = useStore(phylogenyViewerStore, (state) => state.loadingStatus);
  const calculationEngine = useStore(phylogenyViewerStore, (state) => state.engine);

  const alignmentErrorDialogRef = useRef<AlignmentErrorDialogRefMethods>(null);

  const theme = useTheme();

  const isLoading = calculationStatus === CALCULATION_STATUS.LOADING || loadingStatus === LOADING_STATUS.LOADING;

  useEffect(() => {
    const eventBusService = container.resolve(PhylogenyViewerEventBusService);

    const removers = [
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onShowAlignmentErrorDialog', () => {
        alignmentErrorDialogRef.current?.open();
      }),
    ];
    return () => {
      removers.forEach((remove) => remove());
    };
  }, []);

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
    <PageCommon
      isNoInteraction={false}
      title={'Phylogeny Viewer'}
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
          <PhylogenyViewerSearchBar />
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
        extraActions={config.fastaImportExtraActions}
        store={phylogenyViewerStore}
      />
      <BackdropSpinner
        label={`Computing phylogenetic tree (${calculationEngine === 'tn93' ? 'TN93 + NJ' : 'FastTree'})`}
        open={isLoading}
      />
    </PageCommon>
  );
};

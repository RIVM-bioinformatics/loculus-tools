import {
  Box,
  useTheme,
} from '@mui/material';
import { BackdropSpinner } from '@gen-epix/ui-core-components/components/BackdropSpinner';
import {
  use,
  useEffect,
  useMemo,
} from 'react';
import { useStore } from 'zustand';
import type { TreeNode } from '@gen-epix/ui-phylogenetic-tree/models/tree';
import { NewickUtil } from '@gen-epix/ui-phylogenetic-tree/utils/NewickUtil';
import { PageCommonContext } from '@rivm-loculus-tools/frontend-common/components/page';

import { PhyloTreeView } from '../../ui/PhyloTreeView';
import { LEGEND_WIDTH } from '../../../constants/view';
import { CALCULATION_STATUS } from '../../../models/calculation';
import { EventBusService } from '../../../classes/services/EventBusService';
import { SearchBar } from '../../ui/SearchBar';
import { Legend } from '../../ui/Legend/Legend';
import { uiStore } from '../../../stores/uiStore';
import { TreeNotLoaded } from '../../ui/TreeNotLoaded';
import { PhyloViewerPage } from '../../ui/PhyloViewerPage';
import { DataImportDialogLoader } from '../../ui/DataImportDialogLoader';

export const MainPage = () => {
  const newick = useStore(uiStore, (state) => state.newick);
  const colorByField = useStore(uiStore, (state) => state.colorByField);
  const calculationStatus = useStore(uiStore, (state) => state.calculationStatus);
  const calculationEngine = useStore(uiStore, (state) => state.engine);
  const theme = useTheme();

  const { setIsDrawerOpen } = use(PageCommonContext);

  useEffect(() => {
    const eventBusService = EventBusService.getInstance();

    const removers = [
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onToggleDrawer', (isOpen: boolean) => {
        setIsDrawerOpen(isOpen);
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
    <PhyloViewerPage
      isNoInteraction={false}
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
      {/* Global Overlays & Modals */}
      <DataImportDialogLoader />
      <BackdropSpinner
        label={`Computing phylogenetic tree (${calculationEngine === 'tn93' ? 'TN93 + NJ' : 'FastTree'})`}
        open={calculationStatus === CALCULATION_STATUS.LOADING}
      />
    </PhyloViewerPage>
  );
};

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { lighten } from '@mui/material/styles';
import {
  Box,
  Button,
  Typography,
} from '@mui/material';
import ForestOutlinedIcon from '@mui/icons-material/ForestOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import type {
  PhylogeneticTreeHighlightedNodeNamesSubjectValue,
  PhylogeneticTreePathClickEvent,
  PhylogeneticTreeRef,
} from '@gen-epix/ui-phylogenetic-tree/components/PhylogeneticTree';
import { PhylogeneticTree } from '@gen-epix/ui-phylogenetic-tree/components/PhylogeneticTree';
import { NewickUtil } from '@gen-epix/ui-phylogenetic-tree/utils/NewickUtil';
import type { TreeNode } from '@gen-epix/ui-phylogenetic-tree/models/tree';
import { Subject } from '@gen-epix/ui-core/classes/Subject';
import { useStore } from 'zustand';

import { TvsUtil } from '../../utils/TvsUtil';
import { calculationStore } from '../../stores/calculationStore';
import { datasetStore } from '../../stores/datasetStore';
import { treeViewStore } from '../../stores/treeViewStore';
import { metadataStore } from '../../stores/metadataStore';
import {
  TREE_ANCESTOR_DOT_RADIUS,
  TREE_HEADER_HEIGHT,
  TREE_ITEM_HEIGHT,
  TREE_LEAF_DOT_RADIUS,
  TREE_LINKED_SCROLL_DEBOUNCE_DELAY_MS,
  TREE_MAX_SCALE_WIDTH_PX,
  TREE_MAX_ZOOM_LEVEL,
  TREE_MAX_ZOOM_SPEED,
  TREE_MIN_SCALE_WIDTH_PX,
  TREE_MIN_ZOOM_LEVEL,
  TREE_MIN_ZOOM_SPEED,
  TREE_MINIMUM_DISTANCE_PERCENTAGE_TO_SHOW_LABEL,
  TREE_PADDING,
  TREE_PANNING_THRESHOLD,
  TREE_REGULAR_FILL_COLOR_SUPPORT_LINE,
  TREE_SCALE_INCREMENTS,
} from '../../constants/tree';
import { EventBusService } from '../../services/EventBusService';

import { DynamicLegend } from './DynamicLegend';
import { DraggableNodeTooltip } from './DraggableNodeTooltip';

const dimColor = (color: string) => lighten(color, 0.8);

export const PhyloTreeView = () => {
  const newick = useStore(calculationStore, (state) => state.newick);
  const showBranchLengths = useStore(treeViewStore, (state) => state.showBranchLengths);
  const showLeafLabels = useStore(treeViewStore, (state) => state.showLeafLabels);
  // const showSupportLines = useStore(treeViewStore, (state) => state.showSupportLines);
  const showScaleBar = useStore(treeViewStore, (state) => state.showScaleBar);
  const setTooltip = useStore(treeViewStore, (state) => state.setTooltip);

  const colorByField = useStore(metadataStore, (state) => state.colorByField);
  const colorMap = useStore(metadataStore, (state) => state.colorMap);
  const selectedLabelFields = useStore(metadataStore, (state) => state.selectedLabelFields);
  const matchKeyColumn = useStore(metadataStore, (state) => state.matchKeyColumn);
  const parsedMetadata = useStore(datasetStore, (state) => state.parsedMetadata);

  const treeRef = useRef<PhylogeneticTreeRef>(null);

  const highlightedNodeNamesSubject = useMemo(() => {
    const subject = new Subject<PhylogeneticTreeHighlightedNodeNamesSubjectValue>({
      highlightedNodeNames: [],
      persistedHighlightedNodeNames: [],
    });
    return subject;
  }, []);

  useEffect(() => {
    const unsubscribe = treeViewStore.subscribe((state, prevState) => {
      if (JSON.stringify(state.highlightedIds) === JSON.stringify(prevState.highlightedIds)) {
        return;
      }
      if (!state.highlightedIds?.length) {
        highlightedNodeNamesSubject.next({ highlightedNodeNames: [], persistedHighlightedNodeNames: [] });
      }
      highlightedNodeNamesSubject.next({ highlightedNodeNames: highlightedNodeNamesSubject.data?.highlightedNodeNames || [], persistedHighlightedNodeNames: state.highlightedIds });
    });
    return () => {
      unsubscribe();
    };
  }, [highlightedNodeNamesSubject, matchKeyColumn, parsedMetadata]);


  const getLeafLabel = useCallback((nodeName: string) => {
    if (!selectedLabelFields?.length) {
      return nodeName;
    }

    const meta = TvsUtil.getRecordForSample(parsedMetadata, nodeName, matchKeyColumn);
    if (!meta) {
      return nodeName;
    }

    const labels = [nodeName, ...selectedLabelFields.map((field) => meta?.[field] || '<missing>')];
    return labels.join(' | ');
  }, [selectedLabelFields, parsedMetadata, matchKeyColumn]);

  // Parse Newick tree into TreeNode
  const parsedTree = useMemo<null | TreeNode>(() => {
    if (!newick?.trim()) {
      return null;
    }
    try {
      return NewickUtil.parse(newick.trim());
    } catch (e) {
      console.error('Failed to parse Newick tree:', e);
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

  // Build stratification for color-by metadata
  const nodeNameColors = useMemo(() => {
    if (!colorByField || !colorMap || Object.keys(colorMap).length === 0) {
      return undefined;
    }

    const caseIdColors: Record<string, string> = {};
    leafNames.forEach((name) => {
      const meta = TvsUtil.getRecordForSample(parsedMetadata, name, matchKeyColumn);
      if (meta?.[colorByField]) {
        caseIdColors[name] = colorMap[meta[colorByField]] || '#94A3B8';
      }
    });

    return caseIdColors;
  }, [colorByField, colorMap, leafNames, parsedMetadata, matchKeyColumn]);

  // Node click handler
  const onPathClickTree = useCallback(
    ({ mouseEvent, pathProperties }: PhylogeneticTreePathClickEvent) => {
      if (!pathProperties) {
        setTooltip(null);
        return;
      }

      if (pathProperties.treeNode) {
        const { treeNode } = pathProperties;
        const isLeaf = !treeNode.children || treeNode.children.length === 0;

        setTooltip({
          descendantCount: treeNode.size ?? treeNode.subTreeLeaveNames?.length ?? 1,
          isLeaf,
          nodeName: treeNode.name,
          subTreeLeaveNames: treeNode.subTreeLeaveNames,
          treeNode,
          x: mouseEvent.clientX,
          y: mouseEvent.clientY,
        });
        return;
      }

      if (pathProperties.subTreeLeaveNames?.length > 0) {
        setTooltip({
          descendantCount: pathProperties.subTreeLeaveNames.length,
          isLeaf: pathProperties.subTreeLeaveNames.length === 1,
          nodeName: pathProperties.subTreeLeaveNames[0],
          subTreeLeaveNames: pathProperties.subTreeLeaveNames,
          x: mouseEvent.clientX,
          y: mouseEvent.clientY,
        });
      }
    },
    [setTooltip],
  );

  // Expose canvas for export
  const onCanvasChangeTree = useCallback((canvas?: HTMLCanvasElement) => {
    window.phyloTreeCanvas = canvas ?? null;
  }, []);

  const onClickLoadData = useCallback(() => {
    EventBusService.getInstance().emit('onShowImportDialog');
  }, []);

  if (!parsedTree || leafNames.length === 0) {
    return (
      <Box
        sx={{
          alignItems: 'center',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          height: '100%',
          justifyContent: 'center',
          p: 3,
          width: '100%',
        }}
      >
        <ForestOutlinedIcon sx={{ color: 'text.disabled', fontSize: 72 }} />
        <Typography
          color={'text.secondary'}
          sx={{ fontWeight: 600 }}
          variant={'h6'}
        >
          {'No Phylogenetic Tree Loaded'}
        </Typography>
        <Typography
          color={'text.secondary'}
          sx={{ maxWidth: 450, textAlign: 'center' }}
          variant={'body2'}
        >
          {'Load an aligned FASTA sequence file to automatically compute and render an interactive phylogenetic tree.'}
        </Typography>
        <Button
          color={'primary'}
          onClick={onClickLoadData}
          startIcon={<FileUploadOutlinedIcon />}
          sx={{ mt: 1 }}
          variant={'contained'}
        >
          {'Load Data'}
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        backgroundColor: '#FFFFFF',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      {/* Primary Native Tree Canvas (Rendering Branches, Dots, Scale Bar, Leaf Labels, Distances & Highlights) */}
      <PhylogeneticTree
        ancestorDotRadius={TREE_ANCESTOR_DOT_RADIUS}
        ariaLabel={'Phylogenetic tree visualization'}
        backgroundColor={'#FFFFFF'}
        dimFn={dimColor}
        fontFamily={'Noto Sans, sans-serif'}
        getLeafLabel={getLeafLabel}
        headerHeight={showScaleBar ? TREE_HEADER_HEIGHT : 0}
        highlightedNodeNamesSubject={highlightedNodeNamesSubject}
        itemHeight={TREE_ITEM_HEIGHT}
        leafDotRadius={TREE_LEAF_DOT_RADIUS}
        linkedScrollDebounceDelayMs={TREE_LINKED_SCROLL_DEBOUNCE_DELAY_MS}
        maxScaleWidthPx={TREE_MAX_SCALE_WIDTH_PX}
        maxZoomLevel={TREE_MAX_ZOOM_LEVEL}
        maxZoomSpeed={TREE_MAX_ZOOM_SPEED}
        minimumDistancePercentageToShowLabel={TREE_MINIMUM_DISTANCE_PERCENTAGE_TO_SHOW_LABEL}
        minScaleWidthPx={TREE_MIN_SCALE_WIDTH_PX}
        minZoomLevel={TREE_MIN_ZOOM_LEVEL}
        minZoomSpeed={TREE_MIN_ZOOM_SPEED}
        nodeNameColors={nodeNameColors}
        onCanvasChange={onCanvasChangeTree}
        onPathClick={onPathClickTree}
        panningThreshold={TREE_PANNING_THRESHOLD}
        ref={treeRef}
        regularFillColorSupportLine={TREE_REGULAR_FILL_COLOR_SUPPORT_LINE}
        scaleColor={'#475569'}
        scaleIncrements={TREE_SCALE_INCREMENTS}
        shouldShowDistances={showBranchLengths}
        shouldShowLeafLabels={showLeafLabels}
        shouldShowSupportLinesWhenUnlinked={false}
        sortedLeafNames={leafNames}
        supportLineColorLinked={'#0f0'}
        supportLineColorUnlinked={'#f00'}
        tree={parsedTree}
        treeColor={'#334155'}
        treeFont={'10px Noto Sans, sans-serif'}
        treePadding={TREE_PADDING}
      />
      {/* Dynamic Metadata Legend */}
      <DynamicLegend />
      {/* Draggable Tooltip */}
      <DraggableNodeTooltip />
    </Box>
  );
};

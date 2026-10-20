import { container } from 'tsyringe';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { lighten } from '@mui/material/styles';
import { Box } from '@mui/material';
import type {
  PhylogeneticTreeHighlightedNodeNamesSubjectValue,
  PhylogeneticTreePathClickEvent,
  PhylogeneticTreeRef,
} from '@gen-epix/ui-phylogenetic-tree/components/PhylogeneticTree';
import { PhylogeneticTree } from '@gen-epix/ui-phylogenetic-tree/components/PhylogeneticTree';
import { NewickUtil } from '@gen-epix/ui-phylogenetic-tree/utils/NewickUtil';
import type { TreeNode } from '@gen-epix/ui-phylogenetic-tree/models/tree.models';
import { Subject } from '@gen-epix/ui-core/classes/Subject';
import { useStore } from 'zustand';
import { MetaDataUtil } from '@rivm-loculus-tools/common-frontend/utils/MetaDataUtil';
import { ExportUtil } from '@rivm-loculus-tools/common-frontend/utils/ExportUtil';

import { phylogenyViewerStore } from '../../../stores/phylogenyViewerStore';
import {
  MISSING_COLOR,
  TREE_ANCESTOR_DOT_RADIUS,
  TREE_FONT_FAMILY,
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
} from '../../../constants/tree';
import { PhylogenyViewerEventBusService } from '../../../classes/services/PhylogenyViewerEventBusService';
import { TREE_DOWNLOAD_TYPE } from '../../../models/tree.models';

import { PhylogenyTreeViewDraggableNodeTooltip } from './PhylogenyTreeViewDraggableNodeTooltip';

const dimColor = (color: string) => lighten(color, 0.8);

export type PhylogenyTreeViewProps = {
  newick: string;
};

export const PhylogenyTreeView = ({ newick }: PhylogenyTreeViewProps) => {
  const colorByField = useStore(phylogenyViewerStore, (state) => state.colorByField);
  const colorMap = useStore(phylogenyViewerStore, (state) => state.colorMap);
  const matchKeyField = useStore(phylogenyViewerStore, (state) => state.matchKeyField);
  const parsedMetadata = useStore(phylogenyViewerStore, (state) => state.parsedMetadata);
  const selectedLabelFields = useStore(phylogenyViewerStore, (state) => state.selectedLabelFields);
  const setTooltip = useStore(phylogenyViewerStore, (state) => state.setTooltip);
  const showBranchLengths = useStore(phylogenyViewerStore, (state) => state.showBranchLengths);
  const showLeafLabels = useStore(phylogenyViewerStore, (state) => state.showLeafLabels);
  const showScaleBar = useStore(phylogenyViewerStore, (state) => state.showScaleBar);

  const [treeCanvas, setTreeCanvas] = useState<HTMLCanvasElement | null>(null);

  const treeRef = useRef<PhylogeneticTreeRef>(null);

  const highlightedNodeNamesSubject = useMemo(() => {
    const subject = new Subject<PhylogeneticTreeHighlightedNodeNamesSubjectValue>({
      highlightedNodeNames: [],
      persistedHighlightedNodeNames: [],
    });
    return subject;
  }, []);

  useEffect(() => {
    const unsubscribe = phylogenyViewerStore.subscribe((state, prevState) => {
      if (JSON.stringify(state.highlightedIds) === JSON.stringify(prevState.highlightedIds)) {
        return;
      }

      if (!state.highlightedIds?.length) {
        highlightedNodeNamesSubject.next({ highlightedNodeNames: [], persistedHighlightedNodeNames: [] });
        return;
      }
      highlightedNodeNamesSubject.next({ highlightedNodeNames: highlightedNodeNamesSubject.data.highlightedNodeNames, persistedHighlightedNodeNames: state.highlightedIds });
    });
    return () => {
      unsubscribe();
    };
  }, [highlightedNodeNamesSubject, matchKeyField, parsedMetadata]);


  const getLeafLabel = useCallback((nodeName: string) => {
    if (!selectedLabelFields?.length) {
      return nodeName;
    }

    const meta = MetaDataUtil.getRecordForSample(parsedMetadata, nodeName, matchKeyField);
    if (!meta) {
      return nodeName;
    }

    return selectedLabelFields.map((field) => meta?.[field] || '<missing>').join(' | ');
  }, [selectedLabelFields, parsedMetadata, matchKeyField]);

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

  // Build stratification for color-by metadata
  const nodeNameColors = useMemo(() => {
    if (!colorByField || !colorMap || Object.keys(colorMap).length === 0) {
      return undefined;
    }

    const leafColors: { [key: string]: string } = {};
    leafNames.forEach((name) => {
      const meta = MetaDataUtil.getRecordForSample(parsedMetadata, name, matchKeyField);
      if (meta?.[colorByField]) {
        leafColors[name] = colorMap[meta[colorByField]]?.color || MISSING_COLOR;
      } else {
        leafColors[name] = MISSING_COLOR;
      }
    });

    return leafColors;
  }, [colorByField, colorMap, leafNames, parsedMetadata, matchKeyField]);

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
          nodeName: treeNode.name ?? '',
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
          nodeName: pathProperties.subTreeLeaveNames[0] ?? '',
          subTreeLeaveNames: pathProperties.subTreeLeaveNames,
          x: mouseEvent.clientX,
          y: mouseEvent.clientY,
        });
      }
    },
    [setTooltip],
  );

  const onCanvasChangeTree = useCallback((canvas?: HTMLCanvasElement) => {
    setTreeCanvas(canvas ?? null);
  }, []);

  useEffect(() => {
    const eventBusService = container.resolve(PhylogenyViewerEventBusService);
    // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
    const remover = eventBusService.addEventListener('onDownloadCanvas', (type?: TREE_DOWNLOAD_TYPE) => {
      switch (type) {
        case TREE_DOWNLOAD_TYPE.JPEG:
          ExportUtil.downloadCanvasAsImage(treeCanvas, 'jpeg', 'phylogenetic_tree');
          break;
        case TREE_DOWNLOAD_TYPE.PNG:
          ExportUtil.downloadCanvasAsImage(treeCanvas, 'png', 'phylogenetic_tree');
          break;
        case TREE_DOWNLOAD_TYPE.SVG:
          ExportUtil.downloadCanvasAsSvg(treeCanvas, 'phylogenetic_tree.svg');
          break;
        default:
          break;
      }
    });
    return () => {
      remover();
    };
  }, [treeCanvas]);

  return (
    <Box
      sx={{
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
        fontFamily={TREE_FONT_FAMILY}
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
        tree={parsedTree ?? undefined}
        treeColor={'#334155'}
        treeFont={'10px Noto Sans, sans-serif'}
        treePadding={TREE_PADDING}
      />
      {/* Draggable Tooltip */}
      <PhylogenyTreeViewDraggableNodeTooltip />
    </Box>
  );
};

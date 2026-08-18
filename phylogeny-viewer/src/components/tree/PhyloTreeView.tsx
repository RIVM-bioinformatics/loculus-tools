import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import ForestOutlinedIcon from '@mui/icons-material/ForestOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import { PhylogeneticTreeComponent, NewickUtil } from '@gen-epix/ui-casedb';
import type { TreeNode, PhylogeneticTreeComponentRef, PhylogeneticTreeComponentPathClickEvent } from '@gen-epix/ui-casedb';
import { Subject, ConfigService } from '@gen-epix/ui';

export interface Highlighting {
  caseIds: string[];
  origin: string | null;
}

import { useCalculationStore } from '../../stores/calculationStore';
import { useDatasetStore } from '../../stores/datasetStore';
import { useTreeViewStore } from '../../stores/treeViewStore';
import { useMetadataStore } from '../../stores/metadataStore';
import { getRecordForSample } from '../../services/parsers/tsvParser';
import { DynamicLegend } from './DynamicLegend';
import { DraggableNodeTooltip } from './DraggableNodeTooltip';

export const PhyloTreeView: React.FC = () => {
  const newick = useCalculationStore((state) => state.newick);
  const showBranchLengths = useTreeViewStore((state) => state.showBranchLengths);
  const showLeafLabels = useTreeViewStore((state) => state.showLeafLabels);
  const showSupportLines = useTreeViewStore((state) => state.showSupportLines);
  const showScaleBar = useTreeViewStore((state) => state.showScaleBar);
  const highlightedIds = useTreeViewStore((state) => state.highlightedIds);
  const setTooltip = useTreeViewStore((state) => state.setTooltip);
  const setImportModalOpen = useTreeViewStore((state) => state.setImportModalOpen);

  const colorByField = useMetadataStore((state) => state.colorByField);
  const colorMap = useMetadataStore((state) => state.colorMap);
  const selectedLabelFields = useMetadataStore((state) => state.selectedLabelFields);
  const matchKeyColumn = useMetadataStore((state) => state.matchKeyColumn);
  const parsedMetadata = useDatasetStore((state) => state.parsedMetadata);

  const treeRef = useRef<PhylogeneticTreeComponentRef>(null);
  const [renderKey, setRenderKey] = useState(0);

  // Dynamically update ConfigService HEADER_HEIGHT based on showScaleBar toggle
  useEffect(() => {
    try {
      const config = ConfigService.getInstance<any>().config;
      if (config && config.tree) {
        config.tree.HEADER_HEIGHT = showScaleBar ? 40 : 0;
      }
    } catch (e) {
      console.warn('[PhyloTreeView] ConfigService update warning:', e);
    }
  }, [showScaleBar]);

  // Trigger a canvas redraw when visual display options change
  useEffect(() => {
    setRenderKey((prev) => prev + 1);
  }, [
    showBranchLengths,
    showLeafLabels,
    showSupportLines,
    showScaleBar,
    selectedLabelFields,
    matchKeyColumn,
    colorByField,
    colorMap,
  ]);

  // Subject for reactive highlighting (Search & Selection)
  const highlightingSubject = useMemo(
    () =>
      new Subject<Highlighting>({
        caseIds: [],
        origin: null,
      }),
    []
  );

  useEffect(() => {
    highlightingSubject.next({
      caseIds: highlightedIds,
      origin: 'search',
    });
  }, [highlightedIds, highlightingSubject]);

  // Parse Newick tree into TreeNode
  const parsedTree = useMemo<TreeNode | null>(() => {
    if (!newick || !newick.trim()) return null;
    try {
      return NewickUtil.parse(newick.trim());
    } catch (e) {
      console.error('Failed to parse Newick tree:', e);
      return null;
    }
  }, [newick]);

  // Extract leaf names in tree order
  const leafNames = useMemo<string[]>(() => {
    if (!parsedTree) return [];
    return NewickUtil.getSortedNames(parsedTree);
  }, [parsedTree]);

  // Build stratification for color-by metadata
  const stratification = useMemo(() => {
    if (!colorByField || !colorMap || Object.keys(colorMap).length === 0) {
      return undefined;
    }

    const caseIdColors: Record<string, string> = {};
    leafNames.forEach((name) => {
      const meta = getRecordForSample(parsedMetadata, name, matchKeyColumn);
      if (meta && meta[colorByField]) {
        caseIdColors[name] = colorMap[meta[colorByField]] || '#94A3B8';
      }
    });

    return {
      mode: 'FIELD' as any,
      caseIdColors,
      colorForIsMissing: '#94A3B8',
    };
  }, [colorByField, colorMap, leafNames, parsedMetadata, matchKeyColumn]);

  // Node click handler
  const handlePathClick = useCallback(
    ({ mouseEvent, pathProperties }: PhylogeneticTreeComponentPathClickEvent) => {
      if (!pathProperties) {
        setTooltip(null);
        return;
      }

      if (pathProperties.treeNode) {
        const { treeNode } = pathProperties;
        const isLeaf = !treeNode.children || treeNode.children.length === 0;

        setTooltip({
          x: mouseEvent.clientX,
          y: mouseEvent.clientY,
          nodeName: treeNode.name,
          isLeaf,
          treeNode,
          descendantCount: treeNode.size ?? treeNode.subTreeLeaveNames?.length ?? 1,
          subTreeLeaveNames: treeNode.subTreeLeaveNames,
        });
        return;
      }

      if (pathProperties.subTreeLeaveNames && pathProperties.subTreeLeaveNames.length > 0) {
        setTooltip({
          x: mouseEvent.clientX,
          y: mouseEvent.clientY,
          nodeName: pathProperties.subTreeLeaveNames[0],
          isLeaf: pathProperties.subTreeLeaveNames.length === 1,
          descendantCount: pathProperties.subTreeLeaveNames.length,
          subTreeLeaveNames: pathProperties.subTreeLeaveNames,
        });
      }
    },
    [setTooltip]
  );

  // Expose canvas for export
  const handleCanvasChange = useCallback((canvas?: HTMLCanvasElement) => {
    (window as any).__phyloTreeCanvas = canvas || null;
  }, []);

  if (!parsedTree || leafNames.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
          gap: 2,
          p: 3,
        }}
      >
        <ForestOutlinedIcon sx={{ fontSize: 72, color: 'text.disabled' }} />
        <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
          No Phylogenetic Tree Loaded
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 450 }}>
          Load an aligned FASTA sequence file to automatically compute and render an interactive phylogenetic tree.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<FileUploadOutlinedIcon />}
          onClick={() => setImportModalOpen(true)}
          sx={{ mt: 1 }}
        >
          Load Data
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
      }}
    >
      {/* Primary Native Tree Canvas (Rendering Branches, Dots, Scale Bar, Leaf Labels, Distances & Highlights) */}
      <PhylogeneticTreeComponent
        key={`${showScaleBar ? 'scale-on' : 'scale-off'}-${renderKey}`}
        ref={treeRef}
        ariaLabel="Phylogenetic tree visualization"
        highlightingSubject={highlightingSubject}
        itemHeight={28}
        leafOrder={leafNames}
        shouldShowDistances={showBranchLengths}
        shouldShowSupportLinesWhenUnlinked={false}
        stratification={stratification}
        tree={parsedTree}
        onCanvasChange={handleCanvasChange}
        onPathClick={handlePathClick}
      />

      {/* Dynamic Metadata Legend */}
      <DynamicLegend />

      {/* Draggable Tooltip */}
      <DraggableNodeTooltip />
    </Box>
  );
};

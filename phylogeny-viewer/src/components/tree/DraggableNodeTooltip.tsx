import React, { useState, useRef, useEffect } from 'react';
import {
  Paper,
  Box,
  Typography,
  IconButton,
  Divider,
  Button,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import { useTreeViewStore } from '../../stores/treeViewStore';
import { useDatasetStore } from '../../stores/datasetStore';
import { useMetadataStore } from '../../stores/metadataStore';
import { getRecordForSample } from '../../services/parsers/tsvParser';

export const DraggableNodeTooltip: React.FC = () => {
  const tooltip = useTreeViewStore((state) => state.tooltip);
  const setTooltip = useTreeViewStore((state) => state.setTooltip);
  const collapsedNodeIds = useTreeViewStore((state) => state.collapsedNodeIds);
  const toggleCollapseNode = useTreeViewStore((state) => state.toggleCollapseNode);

  const parsedMetadata = useDatasetStore((state) => state.parsedMetadata);

  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  useEffect(() => {
    if (tooltip) {
      // Position within viewport boundaries
      const initialX = Math.min(Math.max(tooltip.x + 15, 20), window.innerWidth - 360);
      const initialY = Math.min(Math.max(tooltip.y - 40, 70), window.innerHeight - 380);
      setPosition({ x: initialX, y: initialY });
    }
  }, [tooltip]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      setPosition({
        x: Math.max(10, Math.min(window.innerWidth - 360, dragStartRef.current.posX + dx)),
        y: Math.max(60, Math.min(window.innerHeight - 300, dragStartRef.current.posY + dy)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!tooltip) return null;

  const isCollapsed = collapsedNodeIds.includes(tooltip.nodeName);

  const matchKeyColumn = useMetadataStore((state) => state.matchKeyColumn);

  // Look up metadata for leaf
  const metadata = tooltip.isLeaf
    ? getRecordForSample(parsedMetadata, tooltip.nodeName, matchKeyColumn) || tooltip.metadata
    : null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: 340,
        maxHeight: 450,
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
    >
      {/* Draggable Header */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          backgroundColor: 'primary.main',
          color: 'primary.contrastText',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflow: 'hidden' }}>
          <DragIndicatorIcon fontSize="small" sx={{ opacity: 0.8 }} />
          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700, maxWidth: 230 }}>
            {tooltip.isLeaf ? tooltip.nodeName : 'Internal Clade Node'}
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => setTooltip(null)} sx={{ color: 'inherit', p: 0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {tooltip.isLeaf ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">
                Type
              </Typography>
              <Chip label="Leaf Sample" size="small" color="primary" variant="outlined" />
            </Box>

            <Divider />

            {metadata ? (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 0.5, display: 'block' }}>
                  Sample Metadata:
                </Typography>
                <Table size="small" sx={{ '& td': { py: 0.5, px: 0.5, fontSize: '0.8rem' } }}>
                  <TableBody>
                    {Object.entries(metadata).map(([key, val]) => (
                      <TableRow key={key}>
                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary', width: '40%' }}>{key}</TableCell>
                        <TableCell sx={{ wordBreak: 'break-word' }}>{val || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                No TSV metadata loaded for this accession.
              </Typography>
            )}
          </>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">
                Subtree Descendants
              </Typography>
              <Chip label={`${tooltip.descendantCount ?? tooltip.subTreeLeaveNames?.length ?? 0} leaves`} size="small" color="secondary" />
            </Box>

            <Divider />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Internal ancestor node in phylogenetic topology.
              </Typography>

              <Button
                variant={isCollapsed ? 'contained' : 'outlined'}
                color="secondary"
                size="small"
                startIcon={isCollapsed ? <UnfoldMoreIcon /> : <UnfoldLessIcon />}
                onClick={() => toggleCollapseNode(tooltip.nodeName)}
                fullWidth
                sx={{ mt: 1 }}
              >
                {isCollapsed ? 'Expand Subtree' : 'Collapse Subtree'}
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Paper>
  );
};

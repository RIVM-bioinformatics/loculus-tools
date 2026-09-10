import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import { useStore } from 'zustand/react';

import { treeViewStore } from '../../stores/treeViewStore';
import { datasetStore } from '../../stores/datasetStore';
import { metadataStore } from '../../stores/metadataStore';
import { TvsUtil } from '../../utils/TvsUtil';

export const DraggableNodeTooltip = () => {
  const tooltip = useStore(treeViewStore, (state) => state.tooltip);
  const setTooltip = useStore(treeViewStore, (state) => state.setTooltip);
  const collapsedNodeIds = useStore(treeViewStore, (state) => state.collapsedNodeIds);
  const toggleCollapseNode = useStore(treeViewStore, (state) => state.toggleCollapseNode);
  const matchKeyColumn = useStore(metadataStore, (state) => state.matchKeyColumn);

  const parsedMetadata = useStore(datasetStore, (state) => state.parsedMetadata);

  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ posX: number; posY: number; startX: number; startY: number }>({
    posX: 0,
    posY: 0,
    startX: 0,
    startY: 0,
  });

  useEffect(() => {
    if (tooltip) {
      // Position within viewport boundaries
      const initialX = Math.min(Math.max(tooltip.x + 15, 20), window.innerWidth - 360);
      const initialY = Math.min(Math.max(tooltip.y - 40, 70), window.innerHeight - 380);
      setPosition({ x: initialX, y: initialY });
    }
  }, [tooltip]);

  const onMouseDownTooltip = useCallback((e: ReactMouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      posX: position.x,
      posY: position.y,
      startX: e.clientX,
      startY: e.clientY,
    };
  }, [position]);

  const onClickClose = useCallback(() => {
    setTooltip(null);
  }, [setTooltip]);

  const onClickToggleCollapse = useCallback(() => {
    if (tooltip) {
      toggleCollapseNode(tooltip.nodeName);
    }
  }, [toggleCollapseNode, tooltip]);

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isDragging) {
        return;
      }
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

  if (!tooltip) {
    return null;
  }

  const isCollapsed = collapsedNodeIds.includes(tooltip.nodeName);

  // Look up metadata for leaf
  const metadata = tooltip.isLeaf
    ? TvsUtil.getRecordForSample(parsedMetadata, tooltip.nodeName, matchKeyColumn) || tooltip.metadata
    : null;

  return (
    <Paper
      elevation={8}
      sx={{
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        left: position.x,
        maxHeight: 450,
        overflow: 'hidden',
        position: 'fixed',
        top: position.y,
        width: 340,
        zIndex: 1300,
      }}
    >
      {/* Draggable Header */}
      <Box
        onMouseDown={onMouseDownTooltip}
        sx={{
          alignItems: 'center',
          backgroundColor: 'primary.main',
          color: 'primary.contrastText',
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'flex',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          userSelect: 'none',
        }}
      >
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 0.5, overflow: 'hidden' }}>
          <DragIndicatorIcon
            fontSize={'small'}
            sx={{ opacity: 0.8 }}
          />
          <Typography
            noWrap
            sx={{ fontWeight: 700, maxWidth: 230 }}
            variant={'subtitle2'}
          >
            {tooltip.isLeaf ? tooltip.nodeName : 'Internal Clade Node'}
          </Typography>
        </Box>
        <IconButton
          onClick={onClickClose}
          size={'small'}
          sx={{ color: 'inherit', p: 0.5 }}
        >
          <CloseIcon fontSize={'small'} />
        </IconButton>
      </Box>
      {/* Content */}
      <Box sx={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 1.5, overflowY: 'auto', p: 2 }}>
        {tooltip.isLeaf ? (
          <>
            <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
              <Typography
                color={'text.secondary'}
                variant={'caption'}
              >
                {'Type'}
              </Typography>
              <Chip
                color={'primary'}
                label={'Leaf Sample'}
                size={'small'}
                variant={'outlined'}
              />
            </Box>
            <Divider />
            {metadata ? (
              <Box>
                <Typography
                  color={'text.secondary'}
                  sx={{ display: 'block', fontWeight: 700, mb: 0.5 }}
                  variant={'caption'}
                >
                  {'Sample Metadata:'}
                </Typography>
                <Table
                  size={'small'}
                  sx={{ '& td': { fontSize: '0.8rem', px: 0.5, py: 0.5 } }}
                >
                  <TableBody>
                    {Object.entries(metadata).map(([key, val]) => (
                      <TableRow key={key}>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 600, width: '40%' }}>
                          {key}
                        </TableCell>
                        <TableCell sx={{ wordBreak: 'break-word' }}>
                          {val || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ) : (
              <Typography
                color={'text.secondary'}
                sx={{ fontStyle: 'italic' }}
                variant={'body2'}
              >
                {'No TSV metadata loaded for this accession.'}
              </Typography>
            )}
          </>
        ) : (
          <>
            <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
              <Typography
                color={'text.secondary'}
                variant={'caption'}
              >
                {'Subtree Descendants'}
              </Typography>
              <Chip
                color={'secondary'}
                label={`${tooltip.descendantCount ?? tooltip.subTreeLeaveNames?.length ?? 0} leaves`}
                size={'small'}
              />
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography
                color={'text.secondary'}
                variant={'body2'}
              >
                {'Internal ancestor node in phylogenetic topology.'}
              </Typography>
              <Button
                color={'secondary'}
                fullWidth
                onClick={onClickToggleCollapse}
                size={'small'}
                startIcon={isCollapsed ? <UnfoldMoreIcon /> : <UnfoldLessIcon />}
                sx={{ mt: 1 }}
                variant={isCollapsed ? 'contained' : 'outlined'}
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

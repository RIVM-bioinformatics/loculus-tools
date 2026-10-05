import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  Box,
  Button,
  Chip,
  ClickAwayListener,
  Divider,
  IconButton,
  Paper,
  Popper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import { useStore } from 'zustand/react';
import { MetaDataUtil } from '@rivm-loculus-tools/frontend-common/utils/MetaDataUtil';

import { phylogenyViewerStore } from '../../../stores/phylogenyViewerStore';

export const PhylogenyTreeViewDraggableNodeTooltip = () => {
  const theme = useTheme();
  const tooltip = useStore(phylogenyViewerStore, (state) => state.tooltip);
  const setTooltip = useStore(phylogenyViewerStore, (state) => state.setTooltip);
  const collapsedNodeIds = useStore(phylogenyViewerStore, (state) => state.collapsedNodeIds);
  const toggleCollapseNode = useStore(phylogenyViewerStore, (state) => state.toggleCollapseNode);
  const matchKeyField = useStore(phylogenyViewerStore, (state) => state.matchKeyField);

  const parsedMetadata = useStore(phylogenyViewerStore, (state) => state.parsedMetadata);

  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (tooltip) {
      // Reset the anchor position whenever a new tooltip is opened.
      setPosition({ x: tooltip.x + 15, y: tooltip.y });
    }
  }, [tooltip]);

  // A fake DOM element (VirtualElement) used by Popper as the positioning anchor.
  // Dragging mutates its bounding rect through state updates.
  const anchorEl = useMemo(
    () => ({
      getBoundingClientRect: (): DOMRect => ({
        bottom: position.y,
        height: 0,
        left: position.x,
        right: position.x,
        toJSON: () => ({}),
        top: position.y,
        width: 0,
        x: position.x,
        y: position.y,
      }),
    }),
    [position],
  );

  const onCloseButtonClick = useCallback(() => {
    setTooltip(null);
  }, [setTooltip]);

  const onClickAway = useCallback(() => {
    setTooltip(null);
  }, [setTooltip]);

  const onToggleCollapseClick = useCallback(() => {
    if (tooltip) {
      toggleCollapseNode(tooltip.nodeName);
    }
  }, [toggleCollapseNode, tooltip]);


  if (!tooltip) {
    return null;
  }

  const isCollapsed = collapsedNodeIds.includes(tooltip.nodeName);

  // Look up metadata for leaf
  const metadata = tooltip.isLeaf
    ? MetaDataUtil.getRecordForSample(parsedMetadata, tooltip.nodeName, matchKeyField) || tooltip.metadata
    : null;

  return (
    <ClickAwayListener onClickAway={onClickAway}>
      <Popper
        anchorEl={anchorEl}
        modifiers={[
          {
            enabled: true,
            name: 'flip',
            options: {
              altBoundary: true,
              padding: 8,
              rootBoundary: 'document',
            },
          },
          {
            enabled: true,
            name: 'preventOverflow',
            options: {
              altAxis: true,
              altBoundary: true,
              padding: 8,
              rootBoundary: 'document',
              tether: true,
            },
          },
        ]}
        open
        placement={'bottom-start'}
        sx={{ zIndex: theme.zIndex.modal }}
      >
        <Paper
          elevation={8}
          sx={{
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'min(450px, calc(100vh - 32px))',
            maxWidth: 'calc(100vw - 32px)',
            overflow: 'hidden',
            width: 600,
          }}
        >
          <Box
            sx={{
              alignItems: 'center',
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              justifyContent: 'space-between',
              px: 1.5,
              py: 1,
              touchAction: 'none',
              userSelect: 'none',
            }}
          >
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 0.5, overflow: 'hidden' }}>
              <Typography
                noWrap
                sx={{ color: 'inherit', fontWeight: 700, maxWidth: 230 }}
                variant={'subtitle2'}
              >
                {tooltip.isLeaf ? tooltip.nodeName : 'Internal Clade Node'}
              </Typography>
            </Box>
            <IconButton
              onClick={onCloseButtonClick}
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
                      {'Sample Metadata'}
                    </Typography>
                    <Table
                      size={'small'}
                    >
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, width: '40%' }}>
                            {'Key'}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, width: '60%' }}>
                            {'Value'}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(metadata).map(([key, val]) => (
                          <TableRow key={key}>
                            <TableCell sx={{ color: 'text.secondary', fontWeight: 600, width: '40%' }}>
                              {key}
                            </TableCell>
                            <TableCell sx={{ color: val ? 'text.primary' : 'text.secondary', width: '60%', wordBreak: 'break-word' }}>
                              {val || '<missing>'}
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
                    disabled
                    fullWidth
                    onClick={onToggleCollapseClick}
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
      </Popper>
    </ClickAwayListener>
  );
};

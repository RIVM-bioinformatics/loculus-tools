import {
  useCallback,
  useState,
} from 'react';
import {
  Box,
  Collapse,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useStore } from 'zustand/react';

import { uiStore } from '../../../stores/uiStore';

export const PhyloTreeViewDynamicLegend = () => {
  const colorByField = useStore(uiStore, (state) => state.colorByField);
  const colorMap = useStore(uiStore, (state) => state.colorMap);
  const valueCounts = useStore(uiStore, (state) => state.valueCounts);

  const [expanded, setExpanded] = useState(true);
  const onClickToggleExpanded = useCallback(() => {
    setExpanded((current) => !current);
  }, []);

  if (!colorByField || Object.keys(colorMap).length === 0) {
    return null;
  }

  const entries = Object.entries(colorMap);

  return (
    <Paper
      elevation={4}
      sx={{
        backdropFilter: 'blur(4px)',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        maxWidth: 240,
        minWidth: 180,
        overflow: 'hidden',
        position: 'absolute',
        right: 20,
        top: 20,
        zIndex: 10,
      }}
    >
      <Box
        onClick={onClickToggleExpanded}
        sx={{
          alignItems: 'center',
          backgroundColor: 'action.hover',
          borderBottom: expanded ? '1px solid' : 'none',
          borderColor: 'divider',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.75,
        }}
      >
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1, overflow: 'hidden' }}>
          <PaletteIcon
            color={'primary'}
            fontSize={'small'}
          />
          <Typography
            noWrap
            sx={{ fontWeight: 700 }}
            variant={'caption'}
          >
            {colorByField}
          </Typography>
        </Box>
        <IconButton
          size={'small'}
          sx={{ p: 0.25 }}
        >
          {expanded ? <ExpandLessIcon fontSize={'small'} /> : <ExpandMoreIcon fontSize={'small'} />}
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, maxHeight: 220, overflowY: 'auto', p: 1.5 }}>
          {entries.map(([val, color]) => (
            <Box
              key={val}
              sx={{ alignItems: 'center', display: 'flex', gap: 1, justifyContent: 'space-between' }}
            >
              <Box sx={{ alignItems: 'center', display: 'flex', gap: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    backgroundColor: color,
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '50%',
                    flexShrink: 0,
                    height: 12,
                    width: 12,
                  }}
                />
                <Tooltip
                  placement={'left'}
                  title={val}
                >
                  <Typography
                    noWrap
                    sx={{ fontSize: '0.75rem' }}
                    variant={'caption'}
                  >
                    {val}
                  </Typography>
                </Tooltip>
              </Box>
              {valueCounts[val] !== undefined && (
                <Typography
                  color={'text.secondary'}
                  sx={{ flexShrink: 0, fontSize: '0.7rem' }}
                  variant={'caption'}
                >
                  {'('}
                  {valueCounts[val]}
                  {')'}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </Collapse>
    </Paper>
  );
};

import React, { useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  IconButton,
  Collapse,
  Tooltip,
} from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useMetadataStore } from '../../stores/metadataStore';

export const DynamicLegend: React.FC = () => {
  const colorByField = useMetadataStore((state) => state.colorByField);
  const colorMap = useMetadataStore((state) => state.colorMap);
  const valueCounts = useMetadataStore((state) => state.valueCounts);

  const [expanded, setExpanded] = useState(true);

  if (!colorByField || Object.keys(colorMap).length === 0) {
    return null;
  }

  const entries = Object.entries(colorMap);

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        top: 20,
        right: 20,
        maxWidth: 240,
        minWidth: 180,
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(4px)',
        zIndex: 10,
      }}
    >
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.75,
          cursor: 'pointer',
          borderBottom: expanded ? '1px solid' : 'none',
          borderColor: 'divider',
          backgroundColor: 'action.hover',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
          <PaletteIcon fontSize="small" color="primary" />
          <Typography variant="caption" noWrap sx={{ fontWeight: 700 }}>
            {colorByField}
          </Typography>
        </Box>
        <IconButton size="small" sx={{ p: 0.25 }}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ p: 1.5, maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {entries.map(([val, color]) => (
            <Box key={val} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: color,
                    flexShrink: 0,
                    border: '1px solid rgba(0,0,0,0.1)',
                  }}
                />
                <Tooltip title={val} placement="left">
                  <Typography variant="caption" noWrap sx={{ fontSize: '0.75rem' }}>
                    {val}
                  </Typography>
                </Tooltip>
              </Box>
              {valueCounts[val] !== undefined && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', flexShrink: 0 }}>
                  ({valueCounts[val]})
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </Collapse>
    </Paper>
  );
};

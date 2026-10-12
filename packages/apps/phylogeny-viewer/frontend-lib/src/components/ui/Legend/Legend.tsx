import { useMemo } from 'react';
import {
  Box,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import { useStore } from 'zustand/react';

import { phylogenyViewerStore } from '../../../stores/phylogenyViewerStore';


export const Legend = () => {
  const colorMap = useStore(phylogenyViewerStore, (state) => state.colorMap);
  const entries = useMemo(() => Object.entries(colorMap), [colorMap]);
  const colorByField = useStore(phylogenyViewerStore, (state) => state.colorByField);
  const theme = useTheme();


  return (
    <Box
      sx={{
        borderLeft: `1px solid ${theme.palette.divider}`,
        height: '100%',
        p: 1.5,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack
          direction={'row'}
          spacing={1}
          sx={{ alignItems: 'center', minWidth: 0 }}
        >
          <PaletteIcon
            color={'primary'}
            sx={{ flexShrink: 0 }}
          />
          <Tooltip
            placement={'top'}
            title={`Legend (${colorByField})`}
          >
            <Typography
              noWrap
              sx={{ fontSize: '0.75rem', fontWeight: 700, minWidth: 0 }}
              variant={'caption'}
            >
              {`Legend (${colorByField})`}
            </Typography>
          </Tooltip>
        </Stack>

      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, maxHeight: '100%', overflowY: 'auto', p: 1.5 }}>
        {entries.map(([value, entry]) => {
          const valueLabel = entry.isMissing ? '<missing>' : value;
          return(
            <Box
              key={valueLabel}
              sx={{ alignItems: 'center', display: 'flex', gap: 1, justifyContent: 'space-between' }}
            >
              <Box sx={{ alignItems: 'center', display: 'flex', gap: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    backgroundColor: entry.color,
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '50%',
                    flexShrink: 0,
                    height: 12,
                    width: 12,
                  }}
                />
                <Tooltip
                  placement={'left'}
                  title={valueLabel}
                >
                  <Typography
                    noWrap
                    sx={{ fontSize: '0.75rem' }}
                    variant={'caption'}
                  >
                    {valueLabel}
                  </Typography>
                </Tooltip>
              </Box>
              {entry.count !== undefined && (
                <Typography
                  color={'text.secondary'}
                  sx={{ flexShrink: 0, fontSize: '0.7rem' }}
                  variant={'caption'}
                >
                  {'('}
                  {entry.count}
                  {')'}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

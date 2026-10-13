import {
  Box,
  darken,
  useTheme,
} from '@mui/material';
import { useMemo } from 'react';
import { useStore } from 'zustand';

import { sequenceEditorStore } from '../../../stores/sequenceEditorStore';
import { EditorUtil } from '../../../utils/EditorUtil';

export const SequenceEditorStatusBar = () => {
  const theme = useTheme();
  const latestMessage = useStore(sequenceEditorStore, (state) => state.latestMessage);
  const meta = useStore(sequenceEditorStore, (state) => state.meta);
  const selection = useStore(sequenceEditorStore, (state) => state.selection);

  const normalizedSelection = useMemo(
    () => EditorUtil.getStatusBarSelectionStats(selection, meta),
    [meta, selection],
  );

  return (
    <Box
      sx={{
        backgroundColor: darken(theme.palette.background.paper, 0.1),
        borderTop: `1px solid ${darken(theme.palette.background.paper, 0.2)}`,
        fontSize: theme.typography.caption,
        height: '100%',
        width: '100%',
      }}
    >
      <Box
        sx={{
          '& > div': {
            alignItems: 'center',
            borderLeft: `1px solid ${darken(theme.palette.background.paper, 0.2)}`,
            display: 'flex',
            paddingLeft: theme.spacing(1),
          },
          '& > div:first-of-type': {
            borderLeft: 'none',
          },
          display: 'grid',
          gap: 4,
          gridTemplateColumns: '1fr repeat(5, max-content)',
          paddingLeft: theme.spacing(1),
          paddingRight: theme.spacing(1),
        }}
      >
        <Box>
          {latestMessage ?? ''}
        </Box>
        <Box>
          {`Pos: ${normalizedSelection.pos}`}
        </Box>
        <Box>
          {`Selected seqs: ${normalizedSelection.selectedSeqs}`}
        </Box>
        <Box>
          {`Cols: ${normalizedSelection.cols}`}
        </Box>
        <Box>
          {`Total selected chars: ${normalizedSelection.totalSelectedChars}`}
        </Box>
        <Box>
          {`Alignment: ${meta?.sequenceCount ?? '0'} sequences, ${meta?.alignmentWidth ?? '0'} positions`}
        </Box>
      </Box>
    </Box>
  );
};

import {
  Box,
  darken,
  useTheme,
} from '@mui/material';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { SequenceEditorStatsSubscribableData } from '../../../classes/services/SequenceEditorStatsSubscribable';
import { SequenceEditorStatsSubscribable } from '../../../classes/services/SequenceEditorStatsSubscribable';
import { EditorUtil } from '../../../utils/EditorUtil';

export const SequenceEditorStatusBar = () => {
  const theme = useTheme();

  const [stats, setStats] = useState<null | SequenceEditorStatsSubscribableData>(null);

  useEffect(() => {
    const remove = SequenceEditorStatsSubscribable.getInstance().subscribe(data => {
      setStats(data);
    });
    return () => remove();
  }, []);

  const normalizedSelection = useMemo(
    () => EditorUtil.getStatusBarSelectionStats(stats?.selection ?? null, stats?.meta ?? null),
    [stats],
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
          {stats?.latestMessage ?? ''}
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
          {`Alignment: ${stats?.meta?.alignmentWidth ?? '0'} sequences ${stats?.meta?.sequenceCount ?? '0'} pos.`}
        </Box>
      </Box>
    </Box>
  );
};

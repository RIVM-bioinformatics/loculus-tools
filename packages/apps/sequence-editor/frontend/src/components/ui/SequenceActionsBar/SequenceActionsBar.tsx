import {
  Box,
  Button,
  ButtonGroup,
  Divider,
  FormControl,
  FormLabel,
} from '@mui/material';
import { useCallback } from 'react';
import { useStore } from 'zustand';

import { READING_MODE } from '../../../models/editor.models';
import { sequenceEditorStore } from '../../../stores/sequenceEditorStore';

const readingFrames = [1, 2, 3] as const;


export const SequenceActionsBar = () => {
  const readingMode = useStore(sequenceEditorStore, (state) => state.readingMode);
  const readingFrame = useStore(sequenceEditorStore, (state) => state.readingFrame ?? 1);

  const onReadingFrameChange = useCallback((frame: 1 | 2 | 3) => {
    sequenceEditorStore.setState({ readingFrame: frame });
  }, []);
  const onReadingFrameOneClick = useCallback(() => onReadingFrameChange(1), [onReadingFrameChange]);
  const onReadingFrameTwoClick = useCallback(() => onReadingFrameChange(2), [onReadingFrameChange]);
  const onReadingFrameThreeClick = useCallback(() => onReadingFrameChange(3), [onReadingFrameChange]);

  const onReadingModeChange = useCallback((newReadingMode: READING_MODE) => {
    sequenceEditorStore.setState({ readingMode: newReadingMode });
  }, []);

  return (
    <Box
      sx={{
        alignItems: 'center',
        display: 'flex',
        gap: 1,
        margin: 1,
      }}
    >
      <FormControl
        sx={{
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'row',
          gap: 1,
        }}
      >
        <FormLabel
          id={'reading-mode-label'}
          sx={{
            fontSize: '0.875rem',
          }}
        >
          {'Reading mode'}
        </FormLabel>
        <ButtonGroup
          aria-labelledby={'reading-mode-label'}
          size={'small'}
          variant={'outlined'}
        >
          <Button
            aria-pressed={readingMode === READING_MODE.NUCLEOTIDE}
            // eslint-disable-next-line @eslint-react/kit/jsx-no-bind
            onClick={() => onReadingModeChange(READING_MODE.NUCLEOTIDE)}
            variant={readingMode === READING_MODE.NUCLEOTIDE ? 'contained' : 'outlined'}
          >
            {'Nucleotide'}
          </Button>
          <Button
            aria-pressed={readingMode === READING_MODE.NUCLEOTIDE_PLUS_AMINO_ACIDS}
            // eslint-disable-next-line @eslint-react/kit/jsx-no-bind
            onClick={() => onReadingModeChange(READING_MODE.NUCLEOTIDE_PLUS_AMINO_ACIDS)}
            variant={readingMode === READING_MODE.NUCLEOTIDE_PLUS_AMINO_ACIDS ? 'contained' : 'outlined'}
          >
            {'Nucleotide + Amino acids'}
          </Button>
          <Button
            aria-pressed={readingMode === READING_MODE.AMINO_ACIDS}
            // eslint-disable-next-line @eslint-react/kit/jsx-no-bind
            onClick={() => onReadingModeChange(READING_MODE.AMINO_ACIDS)}
            variant={readingMode === READING_MODE.AMINO_ACIDS ? 'contained' : 'outlined'}
          >
            {'Amino acids'}
          </Button>
          <Button
            aria-pressed={readingMode === READING_MODE.AMINO_ACIDS_CONDENSED}
            // # !FIXME: to be implemented
            disabled
            // eslint-disable-next-line @eslint-react/kit/jsx-no-bind
            onClick={() => onReadingModeChange(READING_MODE.AMINO_ACIDS_CONDENSED)}
            variant={readingMode === READING_MODE.AMINO_ACIDS_CONDENSED ? 'contained' : 'outlined'}
          >
            {'Amino acids (condensed)'}
          </Button>
        </ButtonGroup>
      </FormControl>
      {readingMode !== READING_MODE.NUCLEOTIDE && (
        <>
          <Divider
            flexItem
            orientation={'vertical'}
            variant={'middle'}
          />
          <FormControl
            sx={{
              alignItems: 'center',
              display: 'flex',
              flexDirection: 'row',
              gap: 1,
            }}
          >
            <FormLabel
              id={'reading-frame-label'}
              sx={{
                fontSize: '0.875rem',
              }}
            >
              {'Reading frame'}
            </FormLabel>
            <ButtonGroup
              aria-labelledby={'reading-frame-label'}
              size={'small'}
              variant={'outlined'}
            >
              <Button
                aria-pressed={readingFrame === readingFrames[0]}
                onClick={onReadingFrameOneClick}
                variant={readingFrame === readingFrames[0] ? 'contained' : 'outlined'}
              >
                {readingFrames[0]}
              </Button>
              <Button
                aria-pressed={readingFrame === readingFrames[1]}
                onClick={onReadingFrameTwoClick}
                variant={readingFrame === readingFrames[1] ? 'contained' : 'outlined'}
              >
                {readingFrames[1]}
              </Button>
              <Button
                aria-pressed={readingFrame === readingFrames[2]}
                onClick={onReadingFrameThreeClick}
                variant={readingFrame === readingFrames[2] ? 'contained' : 'outlined'}
              >
                {readingFrames[2]}
              </Button>
            </ButtonGroup>
          </FormControl>
        </>
      )}

    </Box>
  );
};

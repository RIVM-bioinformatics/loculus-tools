import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useStore } from 'zustand';

import type {
  ConsensusMode,
  Minimap2Preset,
} from '../../../models/pipeline.models';
import { recordMergerStore } from '../../../stores/recordMergerStore';

export type PipelineParameterFieldsProps = {
  layout?: 'column' | 'row';
  showConsensus?: boolean;
  showPreset?: boolean;
};

export const PipelineParameterFields = ({
  layout = 'column',
  showConsensus = true,
  showPreset = true,
}: PipelineParameterFieldsProps) => {
  const pipelineParams = useStore(recordMergerStore, (state) => state.pipelineParams);
  const setConsensusParams = useStore(recordMergerStore, (state) => state.setConsensusParams);

  const onChangePreset = useCallback((event: SelectChangeEvent) => {
    setConsensusParams({ preset: event.target.value as Minimap2Preset });
  }, [setConsensusParams]);

  const onChangeMode = useCallback((event: SelectChangeEvent) => {
    setConsensusParams({ mode: event.target.value as ConsensusMode });
  }, [setConsensusParams]);

  const onChangeMinDepth = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(event.target.value, 10);
    setConsensusParams({ minDepth: Number.isNaN(parsed) || parsed < 1 ? 1 : parsed });
  }, [setConsensusParams]);

  const onChangeCallFract = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(event.target.value);
    const clamped = Number.isNaN(parsed) ? 0.5 : Math.min(1, Math.max(0, parsed));
    setConsensusParams({ callFract: clamped });
  }, [setConsensusParams]);

  const onChangeShowIns = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setConsensusParams({ showIns: event.target.checked });
  }, [setConsensusParams]);

  const onChangeShowDel = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setConsensusParams({ showDel: event.target.checked });
  }, [setConsensusParams]);

  const isRow = layout === 'row';

  return (
    <Box
      sx={{
        alignItems: isRow ? 'flex-start' : 'stretch',
        display: 'flex',
        flexDirection: isRow ? 'row' : 'column',
        flexWrap: isRow ? 'wrap' : 'nowrap',
        gap: isRow ? 1.5 : 2,
      }}
    >
      {showPreset && (
        <FormControl
          fullWidth={!isRow}
          size={'small'}
          sx={isRow ? { minWidth: 230 } : undefined}
        >
          <InputLabel id={`minimap2-preset-label-${layout}`}>
            {'Minimap2 Alignment Preset'}
          </InputLabel>
          <Select
            label={'Minimap2 Alignment Preset'}
            labelId={`minimap2-preset-label-${layout}`}
            onChange={onChangePreset}
            value={pipelineParams.preset}
          >
            <MenuItem value={'asm5'}>
              {'asm5 (Assemblies, <5% divergence)'}
            </MenuItem>
            <MenuItem value={'asm10'}>
              {'asm10 (Assemblies, <10% divergence)'}
            </MenuItem>
            <MenuItem value={'asm20'}>
              {'asm20 (Assemblies, <20% divergence)'}
            </MenuItem>
            <MenuItem value={'map-ont'}>
              {'map-ont (Long reads / Nanopore)'}
            </MenuItem>
            <MenuItem value={'sr'}>
              {'sr (Short paired/single reads)'}
            </MenuItem>
          </Select>
        </FormControl>
      )}
      {showConsensus && (
        <>
          <FormControl
            fullWidth={!isRow}
            size={'small'}
            sx={isRow ? { minWidth: 210 } : undefined}
          >
            <InputLabel id={`consensus-mode-label-${layout}`}>
              {'Samtools Consensus Mode'}
            </InputLabel>
            <Select
              label={'Samtools Consensus Mode'}
              labelId={`consensus-mode-label-${layout}`}
              onChange={onChangeMode}
              value={pipelineParams.mode}
            >
              <MenuItem value={'simple'}>
                {'Simple (Frequency threshold)'}
              </MenuItem>
              <MenuItem value={'bayesian'}>
                {'Bayesian (Quality-aware)'}
              </MenuItem>
            </Select>
          </FormControl>
          <TextField
            label={'Min Depth (-d)'}
            onChange={onChangeMinDepth}
            size={'small'}
            slotProps={{ htmlInput: { min: 1 } }}
            sx={isRow ? { width: 130 } : undefined}
            type={'number'}
            value={pipelineParams.minDepth}
          />
          {pipelineParams.mode === 'simple' && (
            <TextField
              helperText={isRow ? undefined : 'Minimum base fraction (0.0 - 1.0)'}
              label={'Call Fraction (-c)'}
              onChange={onChangeCallFract}
              size={'small'}
              slotProps={{ htmlInput: { max: 1, min: 0, step: 0.05 } }}
              sx={isRow ? { width: 150 } : undefined}
              type={'number'}
              value={pipelineParams.callFract}
            />
          )}
          <Box
            sx={{
              alignItems: isRow ? 'center' : 'flex-start',
              display: 'flex',
              flexDirection: isRow ? 'row' : 'column',
              flexWrap: 'wrap',
              gap: isRow ? 1.5 : 0.5,
              pt: isRow ? 0.5 : 0,
            }}
          >
            <FormControlLabel
              control={(
                <Switch
                  checked={pipelineParams.showIns}
                  onChange={onChangeShowIns}
                  size={'small'}
                />
              )}
              label={(
                <Typography variant={'caption'}>
                  {'Include insertions (--show-ins)'}
                </Typography>
              )}
            />
            <FormControlLabel
              control={(
                <Switch
                  checked={pipelineParams.showDel}
                  onChange={onChangeShowDel}
                  size={'small'}
                />
              )}
              label={(
                <Typography variant={'caption'}>
                  {'Show deletions as * (--show-del)'}
                </Typography>
              )}
            />
          </Box>
        </>
      )}
    </Box>
  );
};

import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SpeedIcon from '@mui/icons-material/Speed';
import BiotechIcon from '@mui/icons-material/Biotech';

import { useCalculationStore } from '../../stores/calculationStore';
import { useDatasetStore } from '../../stores/datasetStore';
import type {
  FastTreeMode,
  TreeEngine,
} from '../../models/calculation';

export const CalculationSettings = () => {
  const engine = useCalculationStore((state) => state.engine);
  const setEngine = useCalculationStore((state) => state.setEngine);
  const fastTreeMode = useCalculationStore((state) => state.fastTreeMode);
  const setFastTreeMode = useCalculationStore((state) => state.setFastTreeMode);
  const fastTreeParams = useCalculationStore((state) => state.fastTreeParams);
  const setFastTreeParams = useCalculationStore((state) => state.setFastTreeParams);
  const status = useCalculationStore((state) => state.status);
  const calculateTree = useCalculationStore((state) => state.calculateTree);
  const lastExecutionTimeMs = useCalculationStore((state) => state.lastExecutionTimeMs);

  const rawFasta = useDatasetStore((state) => state.rawFasta);
  const parsedFasta = useDatasetStore((state) => state.parsedFasta);

  const isCalculating = status === 'loading';
  const hasValidFasta = Boolean(rawFasta && parsedFasta?.isAligned);

  const onChangeEngine = useCallback((event: SelectChangeEvent) => {
    setEngine(event.target.value as TreeEngine);
  }, [setEngine]);
  const onChangeFastTreeMode = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFastTreeMode(event.target.value as FastTreeMode);
  }, [setFastTreeMode]);
  const onChangeModel = useCallback((event: SelectChangeEvent) => {
    setFastTreeParams({ model: event.target.value as 'gtr' | 'jc' });
  }, [setFastTreeParams]);
  const onChangeBootstrapping = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFastTreeParams({ bootstrapping: parseInt(event.target.value, 10) || 0 });
  }, [setFastTreeParams]);
  const onChangeSpr = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFastTreeParams({ spr: parseInt(event.target.value, 10) || 2 });
  }, [setFastTreeParams]);
  const onChangeGamma = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFastTreeParams({ gamma: event.target.checked });
  }, [setFastTreeParams]);
  const onClickCalculate = useCallback(async () => {
    await calculateTree();
  }, [calculateTree]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Algorithm Engine Selector */}
      <FormControl
        fullWidth
        size={'small'}
      >
        <InputLabel id={'engine-select-label'}>
          {'Calculation Engine'}
        </InputLabel>
        <Select
          label={'Calculation Engine'}
          labelId={'engine-select-label'}
          onChange={onChangeEngine}
          value={engine}
        >
          <MenuItem value={'tn93'}>
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
              <SpeedIcon
                color={'primary'}
                fontSize={'small'}
              />
              <Typography
                sx={{ fontWeight: 600 }}
                variant={'body2'}
              >
                {'TN93 + Neighbor-Joining (Fastest)'}
              </Typography>
            </Box>
          </MenuItem>
          <MenuItem value={'fasttree'}>
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
              <BiotechIcon
                color={'secondary'}
                fontSize={'small'}
              />
              <Typography
                sx={{ fontWeight: 600 }}
                variant={'body2'}
              >
                {'FastTree (Biowasm Engine)'}
              </Typography>
            </Box>
          </MenuItem>
        </Select>
      </FormControl>
      {/* FastTree Specific Options */}
      {engine === 'fasttree' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 0.5 }}>
          <Typography
            color={'text.secondary'}
            sx={{ fontWeight: 700 }}
            variant={'caption'}
          >
            {'FastTree Mode:'}
          </Typography>
          <RadioGroup
            onChange={onChangeFastTreeMode}
            value={fastTreeMode}
          >
            <FormControlLabel
              control={<Radio size={'small'} />}
              label={(
                <Typography variant={'body2'}>
                  {'Neighbor-Joining (No ML, Fast)'}
                </Typography>
              )}
              value={'noml'}
            />
            <FormControlLabel
              control={<Radio size={'small'} />}
              label={(
                <Typography variant={'body2'}>
                  {'Maximum Likelihood (ML)'}
                </Typography>
              )}
              value={'ml'}
            />
          </RadioGroup>
          {/* ML Advanced Parameters */}
          {fastTreeMode === 'ml' && (
            <Box
              sx={{
                backgroundColor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                p: 1.5,
              }}
            >
              <Typography
                color={'text.secondary'}
                sx={{ fontWeight: 700 }}
                variant={'caption'}
              >
                {'ML Parameters:'}
              </Typography>
              <FormControl
                fullWidth
                size={'small'}
              >
                <InputLabel id={'ml-model-select-label'}>
                  {'Evolutionary Model'}
                </InputLabel>
                <Select
                  label={'Evolutionary Model'}
                  labelId={'ml-model-select-label'}
                  onChange={onChangeModel}
                  value={fastTreeParams.model}
                >
                  <MenuItem value={'gtr'}>
                    {'GTR (Generalized Time-Reversible)'}
                  </MenuItem>
                  <MenuItem value={'jc'}>
                    {'Jukes-Cantor'}
                  </MenuItem>
                </Select>
              </FormControl>
              <TextField
                helperText={'0 to disable bootstrapping'}
                label={'Bootstrapping Iterations'}
                onChange={onChangeBootstrapping}
                size={'small'}
                type={'number'}
                value={fastTreeParams.bootstrapping}
              />
              <TextField
                label={'SPR Rounds (Subtree Pruning)'}
                onChange={onChangeSpr}
                size={'small'}
                type={'number'}
                value={fastTreeParams.spr}
              />
              <FormControlLabel
                control={(
                  <Switch
                    checked={fastTreeParams.gamma}
                    onChange={onChangeGamma}
                    size={'small'}
                  />
                )}
                label={(
                  <Typography variant={'caption'}>
                    {'Gamma Rate Variation (-gamma)'}
                  </Typography>
                )}
              />
            </Box>
          )}
        </Box>
      )}
      {/* Recalculate Button */}
      <Button
        color={'primary'}
        disabled={isCalculating || !hasValidFasta}
        fullWidth
        onClick={onClickCalculate}
        startIcon={isCalculating ? (
          <CircularProgress
            color={'inherit'}
            size={18}
          />
        ) : <PlayArrowIcon />}
        sx={{ py: 1 }}
        variant={'contained'}
      >
        {isCalculating ? 'Computing Tree...' : 'Calculate Tree'}
      </Button>
      {/* Timing Metrics Badge */}
      {lastExecutionTimeMs !== null && (
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1, justifyContent: 'center' }}>
          <Chip
            color={'success'}
            label={`Computed in ${lastExecutionTimeMs} ms (${engine.toUpperCase()})`}
            size={'small'}
            variant={'outlined'}
          />
        </Box>
      )}
    </Box>
  );
};

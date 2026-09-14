import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
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
import { useStore } from 'zustand/react';

import type {
  FastTreeMode,
  TreeEngine,
} from '../../../models/calculation';
import { CALCULATION_STATUS } from '../../../models/calculation';
import { uiStore } from '../../../stores/uiStore';
import { StatusChip } from '../StatusChip';


export const SideControlPanelCalculationSettings = () => {
  const engine = useStore(uiStore, (state) => state.engine);
  const setEngine = useStore(uiStore, (state) => state.setEngine);
  const fastTreeMode = useStore(uiStore, (state) => state.fastTreeMode);
  const setFastTreeMode = useStore(uiStore, (state) => state.setFastTreeMode);
  const fastTreeParams = useStore(uiStore, (state) => state.fastTreeParams);
  const setFastTreeParams = useStore(uiStore, (state) => state.setFastTreeParams);
  const calculationStatus = useStore(uiStore, (state) => state.calculationStatus);
  const calculationError = useStore(uiStore, (state) => state.calculationError);
  const calculateTree = useStore(uiStore, (state) => state.calculateTree);
  const lastCalculationExecutionTimeMs = useStore(uiStore, (state) => state.lastCalculationExecutionTimeMs);

  const rawFasta = useStore(uiStore, (state) => state.rawFasta);
  const parsedFasta = useStore(uiStore, (state) => state.parsedFasta);

  const isCalculating = calculationStatus === CALCULATION_STATUS.LOADING;
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
          sx={{ '& .MuiSelect-select': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
          value={engine}
        >
          <MenuItem value={'tn93'}>
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1, minWidth: 0, overflow: 'hidden' }}>
              <SpeedIcon
                color={'primary'}
                fontSize={'small'}
              />
              <Typography
                sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                variant={'body2'}
              >
                {'TN93 + Neighbor-Joining (Fastest)'}
              </Typography>
            </Box>
          </MenuItem>
          <MenuItem value={'fasttree'}>
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1, minWidth: 0, overflow: 'hidden' }}>
              <BiotechIcon
                color={'primary'}
                fontSize={'small'}
              />
              <Typography
                sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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
            {'FastTree Mode'}
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
                {'ML Parameters'}
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
      {/* Calculation Error */}
      {calculationStatus === CALCULATION_STATUS.ERROR && calculationError && (
        <Alert severity={'error'}>
          {calculationError}
        </Alert>
      )}
      {/* Timing Metrics Badge */}
      {lastCalculationExecutionTimeMs !== null && (
        <StatusChip
          hasWarning={lastCalculationExecutionTimeMs > 5000}
          label={`Computed in ${lastCalculationExecutionTimeMs} ms (${engine.toUpperCase()})`}
        />
      )}
    </Box>
  );
};

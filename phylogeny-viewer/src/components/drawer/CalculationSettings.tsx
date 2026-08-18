import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Divider,
  Switch,
  TextField,
  Chip,
  CircularProgress,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SpeedIcon from '@mui/icons-material/Speed';
import BiotechIcon from '@mui/icons-material/Biotech';
import { useCalculationStore } from '../../stores/calculationStore';
import { useDatasetStore } from '../../stores/datasetStore';
import type { TreeEngine, FastTreeMode } from '../../types/calculation';

export const CalculationSettings: React.FC = () => {
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

  const handleCalculate = async () => {
    await calculateTree();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Algorithm Engine Selector */}
      <FormControl fullWidth size="small">
        <InputLabel id="engine-select-label">Calculation Engine</InputLabel>
        <Select
          labelId="engine-select-label"
          value={engine}
          label="Calculation Engine"
          onChange={(e) => setEngine(e.target.value as TreeEngine)}
        >
          <MenuItem value="tn93">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SpeedIcon fontSize="small" color="primary" />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                TN93 + Neighbor-Joining (Fastest)
              </Typography>
            </Box>
          </MenuItem>
          <MenuItem value="fasttree">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BiotechIcon fontSize="small" color="secondary" />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                FastTree (Biowasm Engine)
              </Typography>
            </Box>
          </MenuItem>
        </Select>
      </FormControl>

      {/* FastTree Specific Options */}
      {engine === 'fasttree' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            FastTree Mode:
          </Typography>
          <RadioGroup
            value={fastTreeMode}
            onChange={(e) => setFastTreeMode(e.target.value as FastTreeMode)}
          >
            <FormControlLabel
              value="noml"
              control={<Radio size="small" />}
              label={<Typography variant="body2">Neighbor-Joining (No ML, Fast)</Typography>}
            />
            <FormControlLabel
              value="ml"
              control={<Radio size="small" />}
              label={<Typography variant="body2">Maximum Likelihood (ML)</Typography>}
            />
          </RadioGroup>

          {/* ML Advanced Parameters */}
          {fastTreeMode === 'ml' && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                p: 1.5,
                borderRadius: 1.5,
                backgroundColor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                ML Parameters:
              </Typography>

              <FormControl fullWidth size="small">
                <InputLabel id="ml-model-select-label">Evolutionary Model</InputLabel>
                <Select
                  labelId="ml-model-select-label"
                  value={fastTreeParams.model}
                  label="Evolutionary Model"
                  onChange={(e) => setFastTreeParams({ model: e.target.value as 'gtr' | 'jc' })}
                >
                  <MenuItem value="gtr">GTR (Generalized Time-Reversible)</MenuItem>
                  <MenuItem value="jc">Jukes-Cantor</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Bootstrapping Iterations"
                size="small"
                type="number"
                value={fastTreeParams.bootstrapping}
                onChange={(e) => setFastTreeParams({ bootstrapping: parseInt(e.target.value, 10) || 0 })}
                helperText="0 to disable bootstrapping"
              />

              <TextField
                label="SPR Rounds (Subtree Pruning)"
                size="small"
                type="number"
                value={fastTreeParams.spr}
                onChange={(e) => setFastTreeParams({ spr: parseInt(e.target.value, 10) || 2 })}
              />

              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={fastTreeParams.gamma}
                    onChange={(e) => setFastTreeParams({ gamma: e.target.checked })}
                  />
                }
                label={<Typography variant="caption">Gamma Rate Variation (-gamma)</Typography>}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Recalculate Button */}
      <Button
        variant="contained"
        color="primary"
        startIcon={isCalculating ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
        onClick={handleCalculate}
        disabled={isCalculating || !hasValidFasta}
        fullWidth
        sx={{ py: 1 }}
      >
        {isCalculating ? 'Computing Tree...' : 'Calculate Tree'}
      </Button>

      {/* Timing Metrics Badge */}
      {lastExecutionTimeMs !== null && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <Chip
            size="small"
            variant="outlined"
            color="success"
            label={`Computed in ${lastExecutionTimeMs} ms (${engine.toUpperCase()})`}
          />
        </Box>
      )}
    </Box>
  );
};

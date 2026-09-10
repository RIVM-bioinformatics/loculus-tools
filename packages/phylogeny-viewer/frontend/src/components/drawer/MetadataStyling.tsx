import type { ChangeEvent } from 'react';
import {
  useCallback,
  useMemo,
} from 'react';
import {
  Box,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import StyleIcon from '@mui/icons-material/Style';
import KeyIcon from '@mui/icons-material/Key';
import { useStore } from 'zustand';

import { metadataStore } from '../../stores/metadataStore';
import { datasetStore } from '../../stores/datasetStore';
import { StatusChip } from '../ui/StatusChip';

export const MetadataStyling = () => {
  const parsedMetadata = useStore(datasetStore, (state) => state.parsedMetadata);
  const parsedFasta = useStore(datasetStore, (state) => state.parsedFasta);

  const matchKeyColumn = useStore(metadataStore, (state) => state.matchKeyColumn);
  const setMatchKeyColumn = useStore(metadataStore, (state) => state.setMatchKeyColumn);
  const columnMatchCounts = useStore(metadataStore, (state) => state.columnMatchCounts);

  const colorByField = useStore(metadataStore, (state) => state.colorByField);
  const setColorByField = useStore(metadataStore, (state) => state.setColorByField);
  const selectedLabelFields = useStore(metadataStore, (state) => state.selectedLabelFields);
  const toggleLabelField = useStore(metadataStore, (state) => state.toggleLabelField);

  const columns = parsedMetadata?.columns || [];
  const records = useMemo(() => parsedMetadata?.records ?? [], [parsedMetadata]);
  const totalTaxa = parsedFasta?.sequences?.length || 0;

  const onChangeColorBy = useCallback((event: SelectChangeEvent) => {
    const field = event.target.value;
    if (field === 'none' || !field) {
      setColorByField(null);
      return;
    }
    const vals = records.map((r) => r[field] || '');
    const uniqueVals = Array.from(new Set(vals.filter(Boolean)));
    setColorByField(field, uniqueVals, vals);
  }, [records, setColorByField]);

  const onChangeMatchKey = useCallback((event: SelectChangeEvent) => {
    const col = event.target.value;
    setMatchKeyColumn(col);
    // Refresh color by if active
    if (colorByField) {
      const vals = records.map((r) => r[colorByField] || '');
      const uniqueVals = Array.from(new Set(vals.filter(Boolean)));
      setColorByField(colorByField, uniqueVals, vals);
    }
  }, [colorByField, records, setColorByField, setMatchKeyColumn]);

  const onChangeLabelField = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    toggleLabelField(event.target.value);
  }, [toggleLabelField]);

  const eligibleLabelFields = columns.filter((col) => col !== matchKeyColumn);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Sequence ID Matching Column */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
          <KeyIcon
            color={'primary'}
            fontSize={'small'}
          />
          <Typography
            color={'text.secondary'}
            sx={{ fontWeight: 700 }}
            variant={'caption'}
          >
            {'Sequence ID Matching Column'}
          </Typography>
        </Box>
        <FormControl
          fullWidth
          size={'small'}
        >
          <InputLabel id={'match-key-label'}>
            {'Matching Key Column'}
          </InputLabel>
          <Select
            disabled={columns.length === 0}
            label={'Matching Key Column'}
            labelId={'match-key-label'}
            onChange={onChangeMatchKey}
            value={matchKeyColumn || (columns[0] ?? '')}
          >
            {columns.map((col) => {
              const count = columnMatchCounts[col];
              const matchText =
                totalTaxa > 0 && count !== undefined
                  ? ` (${count}/${totalTaxa} matches)`
                  : '';
              return (
                <MenuItem
                  key={col}
                  value={col}
                >
                  <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>
                      {col}
                    </span>
                    {matchText && (
                      <Typography
                        color={count > 0 ? 'success.main' : 'text.disabled'}
                        sx={{ ml: 1 }}
                        variant={'caption'}
                      >
                        {matchText}
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        {matchKeyColumn && totalTaxa > 0 && columnMatchCounts[matchKeyColumn] !== undefined && (
          <StatusChip
            hasWarning={columnMatchCounts[matchKeyColumn] === 0}
            label={`${columnMatchCounts[matchKeyColumn]}/${totalTaxa} sequences matched`}
          />
        )}
      </Box>
      <Divider />
      {/* Color-by Dropdown */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
          <PaletteIcon
            color={'primary'}
            fontSize={'small'}
          />
          <Typography
            color={'text.secondary'}
            sx={{ fontWeight: 700 }}
            variant={'caption'}
          >
            {'Color nodes by attribute'}
          </Typography>
        </Box>
        <FormControl
          fullWidth
          size={'small'}
        >
          <InputLabel id={'color-by-label'}>
            {'Color-by Field'}
          </InputLabel>
          <Select
            disabled={columns.length === 0}
            label={'Color-by Field'}
            labelId={'color-by-label'}
            onChange={onChangeColorBy}
            value={colorByField || 'none'}
          >
            <MenuItem value={'none'}>
              <em>
                {'None (Default)'}
              </em>
            </MenuItem>
            {columns.map((col) => (
              <MenuItem
                key={col}
                value={col}
              >
                {col}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {columns.length === 0 && (
          <Typography
            color={'text.secondary'}
            sx={{ fontStyle: 'italic' }}
            variant={'caption'}
          >
            {'Load a TSV metadata file to color nodes by attributes.'}
          </Typography>
        )}
      </Box>
      <Divider />
      {/* Composite Leaf Label Builder */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
          <StyleIcon
            color={'primary'}
            fontSize={'small'}
          />
          <Typography
            color={'text.secondary'}
            sx={{ fontWeight: 700 }}
            variant={'caption'}
          >
            {'Leaf label composition'}
          </Typography>
        </Box>
        <Typography
          color={'text.secondary'}
          variant={'caption'}
        >
          {'Format: '}
          <code>
            {matchKeyColumn || 'ID'}
            {selectedLabelFields.length > 0 ? ` | ${selectedLabelFields.join(' | ')}` : ''}
          </code>
        </Typography>
        <Paper
          sx={{ borderRadius: 1.5, maxHeight: 180, overflowY: 'auto', p: 1.5 }}
          variant={'outlined'}
        >
          {eligibleLabelFields.length > 0 ? (
            <FormGroup>
              {eligibleLabelFields.map((field) => (
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={selectedLabelFields.includes(field)}
                      onChange={onChangeLabelField}
                      size={'small'}
                      value={field}
                    />
                  )}
                  key={field}
                  label={(
                    <Typography variant={'caption'}>
                      {field}
                    </Typography>
                  )}
                  sx={{ my: -0.25 }}
                />
              ))}
            </FormGroup>
          ) : (
            <Typography
              color={'text.secondary'}
              sx={{ fontStyle: 'italic' }}
              variant={'caption'}
            >
              {'No metadata attributes available.'}
            </Typography>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

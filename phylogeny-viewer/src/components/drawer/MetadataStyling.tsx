import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
  Paper,
  Chip,
} from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import StyleIcon from '@mui/icons-material/Style';
import KeyIcon from '@mui/icons-material/Key';
import { useMetadataStore } from '../../stores/metadataStore';
import { useDatasetStore } from '../../stores/datasetStore';

export const MetadataStyling: React.FC = () => {
  const parsedMetadata = useDatasetStore((state) => state.parsedMetadata);
  const parsedFasta = useDatasetStore((state) => state.parsedFasta);

  const matchKeyColumn = useMetadataStore((state) => state.matchKeyColumn);
  const setMatchKeyColumn = useMetadataStore((state) => state.setMatchKeyColumn);
  const columnMatchCounts = useMetadataStore((state) => state.columnMatchCounts);

  const colorByField = useMetadataStore((state) => state.colorByField);
  const setColorByField = useMetadataStore((state) => state.setColorByField);
  const selectedLabelFields = useMetadataStore((state) => state.selectedLabelFields);
  const toggleLabelField = useMetadataStore((state) => state.toggleLabelField);

  const columns = parsedMetadata?.columns || [];
  const records = parsedMetadata?.records || [];
  const totalTaxa = parsedFasta?.sequences?.length || 0;

  const handleColorByChange = (field: string) => {
    if (field === 'none' || !field) {
      setColorByField(null);
      return;
    }
    const vals = records.map((r) => r[field] || '');
    const uniqueVals = Array.from(new Set(vals.filter(Boolean)));
    setColorByField(field, uniqueVals, vals);
  };

  const handleMatchKeyChange = (col: string) => {
    setMatchKeyColumn(col);
    // Refresh color by if active
    if (colorByField) {
      const vals = records.map((r) => r[colorByField] || '');
      const uniqueVals = Array.from(new Set(vals.filter(Boolean)));
      setColorByField(colorByField, uniqueVals, vals);
    }
  };

  const eligibleLabelFields = columns.filter((col) => col !== matchKeyColumn);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Sequence ID Matching Column */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyIcon fontSize="small" color="primary" />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            Sequence ID Matching Column:
          </Typography>
        </Box>

        <FormControl fullWidth size="small">
          <InputLabel id="match-key-label">Matching Key Column</InputLabel>
          <Select
            labelId="match-key-label"
            value={matchKeyColumn || (columns[0] ?? '')}
            label="Matching Key Column"
            onChange={(e) => handleMatchKeyChange(e.target.value)}
            disabled={columns.length === 0}
          >
            {columns.map((col) => {
              const count = columnMatchCounts[col];
              const matchText =
                totalTaxa > 0 && count !== undefined
                  ? ` (${count}/${totalTaxa} matches)`
                  : '';
              return (
                <MenuItem key={col} value={col}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span>{col}</span>
                    {matchText && (
                      <Typography variant="caption" color={count > 0 ? 'success.main' : 'text.disabled'} sx={{ ml: 1 }}>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
            <Chip
              size="small"
              variant="outlined"
              color={columnMatchCounts[matchKeyColumn] > 0 ? 'success' : 'warning'}
              label={`${columnMatchCounts[matchKeyColumn]}/${totalTaxa} sequences matched`}
              sx={{ fontSize: '0.7rem', height: 20 }}
            />
          </Box>
        )}
      </Box>

      <Divider />

      {/* Color-by Dropdown */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PaletteIcon fontSize="small" color="primary" />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            Color Nodes by Attribute:
          </Typography>
        </Box>

        <FormControl fullWidth size="small">
          <InputLabel id="color-by-label">Color-by Field</InputLabel>
          <Select
            labelId="color-by-label"
            value={colorByField || 'none'}
            label="Color-by Field"
            onChange={(e) => handleColorByChange(e.target.value)}
            disabled={columns.length === 0}
          >
            <MenuItem value="none">
              <em>None (Default)</em>
            </MenuItem>
            {columns.map((col) => (
              <MenuItem key={col} value={col}>
                {col}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {columns.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Load a TSV metadata file to color nodes by attributes.
          </Typography>
        )}
      </Box>

      <Divider />

      {/* Composite Leaf Label Builder */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StyleIcon fontSize="small" color="secondary" />
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            Composite Leaf Labels:
          </Typography>
        </Box>

        <Typography variant="caption" color="text.secondary">
          Format: <code>{matchKeyColumn || 'ID'}{selectedLabelFields.length > 0 ? ` | ${selectedLabelFields.join(' | ')}` : ''}</code>
        </Typography>

        <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 180, overflowY: 'auto', borderRadius: 1.5 }}>
          {eligibleLabelFields.length > 0 ? (
            <FormGroup>
              {eligibleLabelFields.map((field) => (
                <FormControlLabel
                  key={field}
                  control={
                    <Checkbox
                      size="small"
                      checked={selectedLabelFields.includes(field)}
                      onChange={() => toggleLabelField(field)}
                    />
                  }
                  label={<Typography variant="caption">{field}</Typography>}
                  sx={{ my: -0.25 }}
                />
              ))}
            </FormGroup>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No metadata attributes available.
            </Typography>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

import {
  useCallback,
  useMemo,
} from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import { useStore } from 'zustand';
import { SearchBar } from '@rivm-loculus-tools/common-frontend/components/ui/SearchBar';
import { MetaDataUtil } from '@rivm-loculus-tools/common-frontend/utils/MetaDataUtil';

import { PIPELINE_STATUS } from '../../../models/pipeline.models';
import { recordMergerStore } from '../../../stores/recordMergerStore';

import { RecordSelectionTableRow } from './RecordSelectionTableRow';

const MAX_DISPLAY_METADATA_COLUMNS = 6;

export const RecordSelectionView = () => {
  const parsedFasta = useStore(recordMergerStore, (state) => state.parsedFasta);
  const parsedReferenceFasta = useStore(recordMergerStore, (state) => state.parsedReferenceFasta);
  const parsedMetadata = useStore(recordMergerStore, (state) => state.parsedMetadata);
  const matchKeyField = useStore(recordMergerStore, (state) => state.matchKeyField);
  const selectedSequenceIds = useStore(recordMergerStore, (state) => state.selectedSequenceIds);
  const searchQuery = useStore(recordMergerStore, (state) => state.searchQuery);
  const filterColumn = useStore(recordMergerStore, (state) => state.filterColumn);
  const filterValue = useStore(recordMergerStore, (state) => state.filterValue);
  const pipelineStatus = useStore(recordMergerStore, (state) => state.pipelineStatus);
  const pipelineError = useStore(recordMergerStore, (state) => state.pipelineError);

  const toggleSequenceSelection = useStore(recordMergerStore, (state) => state.toggleSequenceSelection);
  const selectSequences = useStore(recordMergerStore, (state) => state.selectSequences);
  const clearSelection = useStore(recordMergerStore, (state) => state.clearSelection);
  const setSearchQuery = useStore(recordMergerStore, (state) => state.setSearchQuery);
  const setFilterColumn = useStore(recordMergerStore, (state) => state.setFilterColumn);
  const setFilterValue = useStore(recordMergerStore, (state) => state.setFilterValue);
  const runAlignment = useStore(recordMergerStore, (state) => state.runAlignment);

  const allSequences = useMemo(() => parsedFasta?.sequences ?? [], [parsedFasta]);
  const referenceSequence = parsedReferenceFasta?.sequences?.[0];
  const metadataColumns = useMemo(() => parsedMetadata?.columns ?? [], [parsedMetadata]);
  const visibleMetadataColumns = useMemo(
    () => metadataColumns.slice(0, MAX_DISPLAY_METADATA_COLUMNS),
    [metadataColumns],
  );

  const filterColumnValues = useMemo(() => {
    if (!filterColumn || !parsedMetadata?.records) {
      return [];
    }
    const values = new Set<string>();
    for (const rec of parsedMetadata.records) {
      const val = rec[filterColumn]?.trim();
      if (val) {
        values.add(val);
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [filterColumn, parsedMetadata]);

  const filteredSequences = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();

    return allSequences.filter((seq) => {
      const metaRec = MetaDataUtil.getRecordForSample(parsedMetadata, seq.id, matchKeyField);

      if (filterColumn && filterValue) {
        if ((metaRec?.[filterColumn] ?? '') !== filterValue) {
          return false;
        }
      }

      if (!trimmedQuery) {
        return true;
      }

      if (
        seq.id.toLowerCase().includes(trimmedQuery) ||
        seq.header.toLowerCase().includes(trimmedQuery)
      ) {
        return true;
      }

      if (metaRec) {
        return Object.values(metaRec).some(
          (val) => typeof val === 'string' && val.toLowerCase().includes(trimmedQuery),
        );
      }

      return false;
    });
  }, [allSequences, filterColumn, filterValue, matchKeyField, parsedMetadata, searchQuery]);

  const selectedSet = useMemo(() => new Set(selectedSequenceIds), [selectedSequenceIds]);

  const filteredSelectedCount = useMemo(
    () => filteredSequences.filter((seq) => selectedSet.has(seq.id)).length,
    [filteredSequences, selectedSet],
  );

  const isAllFilteredSelected = filteredSequences.length > 0 && filteredSelectedCount === filteredSequences.length;
  const isIndeterminate = filteredSelectedCount > 0 && filteredSelectedCount < filteredSequences.length;

  const isPipelineRunning =
    pipelineStatus === PIPELINE_STATUS.ALIGNING ||
    pipelineStatus === PIPELINE_STATUS.SORTING_INDEXING ||
    pipelineStatus === PIPELINE_STATUS.CALLING_CONSENSUS;

  const onSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, [setSearchQuery]);

  const onChangeFilterColumn = useCallback((event: SelectChangeEvent) => {
    const val = event.target.value;
    setFilterColumn(val || null);
  }, [setFilterColumn]);

  const onChangeFilterValue = useCallback((event: SelectChangeEvent) => {
    setFilterValue(event.target.value);
  }, [setFilterValue]);

  const onToggleAllFiltered = useCallback(() => {
    const filteredIds = filteredSequences.map((seq) => seq.id);
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredIds);
      selectSequences(selectedSequenceIds.filter((id) => !filteredIdSet.has(id)));
    } else {
      selectSequences([...selectedSequenceIds, ...filteredIds]);
    }
  }, [filteredSequences, isAllFilteredSelected, selectSequences, selectedSequenceIds]);

  const onClickSelectAllFiltered = useCallback(() => {
    selectSequences([...selectedSequenceIds, ...filteredSequences.map((seq) => seq.id)]);
  }, [filteredSequences, selectSequences, selectedSequenceIds]);

  const onClickClearSelection = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const onClickRunAlignment = useCallback(async () => {
    await runAlignment();
  }, [runAlignment]);

  const onToggleRecord = useCallback((id: string) => {
    toggleSequenceSelection(id);
  }, [toggleSequenceSelection]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        height: '100%',
        overflow: 'hidden',
        p: 2,
      }}
    >
      {/* Reference & Action Banner */}
      <Paper
        sx={{
          alignItems: { md: 'center', xs: 'flex-start' },
          borderRadius: 2,
          display: 'flex',
          flexDirection: { md: 'row', xs: 'column' },
          gap: 2,
          justifyContent: 'space-between',
          p: 2,
        }}
        variant={'outlined'}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
          <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <MenuBookOutlinedIcon
              color={'primary'}
              fontSize={'small'}
            />
            <Typography
              sx={{ fontWeight: 700 }}
              variant={'subtitle2'}
            >
              {'Reference Sequence:'}
            </Typography>
            <Chip
              color={'primary'}
              label={referenceSequence ? `${referenceSequence.id} (${referenceSequence.length.toLocaleString()} bp)` : 'None'}
              size={'small'}
              sx={{ fontFamily: 'monospace', fontWeight: 600 }}
              variant={'outlined'}
            />
            <Chip
              label={`${selectedSequenceIds.length} of ${allSequences.length} records selected`}
              size={'small'}
              variant={'filled'}
            />
          </Box>
          <Typography
            color={'text.secondary'}
            variant={'caption'}
          >
            {'The reference sequence is used strictly as the alignment target and JBrowse2 coordinate frame (excluded from consensus calling).'}
          </Typography>
        </Box>
        <Box sx={{ alignItems: 'center', display: 'flex', flexShrink: 0, flexWrap: 'wrap', gap: 1 }}>
          <Button
            disabled={filteredSequences.length === 0 || isPipelineRunning}
            onClick={onClickSelectAllFiltered}
            size={'small'}
            startIcon={<SelectAllIcon />}
            variant={'outlined'}
          >
            {'Select All Filtered'}
          </Button>
          <Button
            disabled={selectedSequenceIds.length === 0 || isPipelineRunning}
            onClick={onClickClearSelection}
            size={'small'}
            startIcon={<ClearAllIcon />}
            variant={'outlined'}
          >
            {'Clear'}
          </Button>
          <Button
            color={'primary'}
            disabled={selectedSequenceIds.length === 0 || !referenceSequence || isPipelineRunning}
            onClick={onClickRunAlignment}
            startIcon={isPipelineRunning ? (
              <CircularProgress
                color={'inherit'}
                size={18}
              />
            ) : <MergeTypeIcon />}
            variant={'contained'}
          >
            {`Align Selected Records (${selectedSequenceIds.length} selected)`}
          </Button>
        </Box>
      </Paper>
      {pipelineError && (
        <Alert severity={'error'}>
          {pipelineError}
        </Alert>
      )}
      {/* Search & Metadata Filter Toolbar */}
      <Paper
        sx={{
          alignItems: 'center',
          borderRadius: 2,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          p: 1.5,
        }}
        variant={'outlined'}
      >
        <Box sx={{ flex: '1 1 280px', minWidth: 220 }}>
          <SearchBar
            numResults={filteredSequences.length}
            onSearchQueryChange={onSearchQueryChange}
            searchQuery={searchQuery}
          />
        </Box>
        {metadataColumns.length > 0 && (
          <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            <FormControl
              size={'small'}
              sx={{ minWidth: 180 }}
            >
              <InputLabel id={'record-filter-col-label'}>
                {'Filter by Metadata'}
              </InputLabel>
              <Select
                label={'Filter by Metadata'}
                labelId={'record-filter-col-label'}
                onChange={onChangeFilterColumn}
                value={filterColumn ?? ''}
              >
                <MenuItem value={''}>
                  <em>
                    {'None'}
                  </em>
                </MenuItem>
                {metadataColumns.map((col) => (
                  <MenuItem
                    key={col}
                    value={col}
                  >
                    {col}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {filterColumn && (
              <FormControl
                size={'small'}
                sx={{ minWidth: 180 }}
              >
                <InputLabel id={'record-filter-val-label'}>
                  {`Value (${filterColumn})`}
                </InputLabel>
                <Select
                  label={`Value (${filterColumn})`}
                  labelId={'record-filter-val-label'}
                  onChange={onChangeFilterValue}
                  value={filterValue}
                >
                  <MenuItem value={''}>
                    <em>
                      {'All values'}
                    </em>
                  </MenuItem>
                  {filterColumnValues.map((val) => (
                    <MenuItem
                      key={val}
                      value={val}
                    >
                      {val}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        )}
      </Paper>
      {/* Interactive Records Selection Table */}
      <TableContainer
        component={Paper}
        sx={{ flex: 1, overflow: 'auto' }}
        variant={'outlined'}
      >
        <Table
          size={'small'}
          stickyHeader
        >
          <TableHead>
            <TableRow>
              <TableCell padding={'checkbox'}>
                <Checkbox
                  checked={isAllFilteredSelected}
                  indeterminate={isIndeterminate}
                  onChange={onToggleAllFiltered}
                  size={'small'}
                  slotProps={{ input: { 'aria-label': 'Select all filtered records' } }}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>
                {'Sequence ID'}
              </TableCell>
              <TableCell
                align={'right'}
                sx={{ fontWeight: 700 }}
              >
                {'Length (bp)'}
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>
                {'Header'}
              </TableCell>
              {visibleMetadataColumns.map((col) => (
                <TableCell
                  key={col}
                  sx={{ fontWeight: 700 }}
                >
                  {col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSequences.map((seq) => (
              <RecordSelectionTableRow
                isSelected={selectedSet.has(seq.id)}
                key={seq.id}
                metadataColumns={visibleMetadataColumns}
                metadataRecord={MetaDataUtil.getRecordForSample(parsedMetadata, seq.id, matchKeyField)}
                onToggle={onToggleRecord}
                sequence={seq}
              />
            ))}
            {filteredSequences.length === 0 && (
              <TableRow>
                <TableCell
                  align={'center'}
                  colSpan={4 + visibleMetadataColumns.length}
                  sx={{ py: 4 }}
                >
                  <Typography
                    color={'text.secondary'}
                    variant={'body2'}
                  >
                    {'No FASTA records match the current search or metadata filter.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

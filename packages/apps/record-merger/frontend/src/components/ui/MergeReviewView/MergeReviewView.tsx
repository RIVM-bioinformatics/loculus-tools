import {
  useCallback,
  useMemo,
} from 'react';
import {
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { useStore } from 'zustand';
import { ExportUtil } from '@rivm-loculus-tools/common-frontend/utils/ExportUtil';
import { MetaDataUtil } from '@rivm-loculus-tools/common-frontend/utils/MetaDataUtil';

import type {
  AlignmentResult,
  ConsensusResult,
} from '../../../models/pipeline.models';
import { recordMergerStore } from '../../../stores/recordMergerStore';

export type MergeReviewViewProps = {
  alignmentResult: AlignmentResult;
  consensusResult: ConsensusResult;
};

const MAX_REVIEW_METADATA_COLUMNS = 6;

const computeBaseCounts = (sequence: string) => {
  const counts = { a: 0, c: 0, g: 0, other: 0, t: 0 };
  for (const ch of sequence.toUpperCase()) {
    if (ch === 'A') {
      counts.a += 1;
    } else if (ch === 'C') {
      counts.c += 1;
    } else if (ch === 'G') {
      counts.g += 1;
    } else if (ch === 'T' || ch === 'U') {
      counts.t += 1;
    } else {
      counts.other += 1;
    }
  }
  return counts;
};

export const MergeReviewView = ({ alignmentResult, consensusResult }: MergeReviewViewProps) => {
  const parsedFasta = useStore(recordMergerStore, (state) => state.parsedFasta);
  const parsedMetadata = useStore(recordMergerStore, (state) => state.parsedMetadata);
  const matchKeyField = useStore(recordMergerStore, (state) => state.matchKeyField);
  const setActiveStep = useStore(recordMergerStore, (state) => state.setActiveStep);

  const sequenceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const seq of parsedFasta?.sequences ?? []) {
      map.set(seq.id, seq.length);
    }
    return map;
  }, [parsedFasta]);

  const visibleMetadataColumns = useMemo(
    () => (parsedMetadata?.columns ?? []).slice(0, MAX_REVIEW_METADATA_COLUMNS),
    [parsedMetadata],
  );

  const baseCounts = useMemo(
    () => computeBaseCounts(consensusResult.consensusSequence),
    [consensusResult.consensusSequence],
  );

  const onClickBackToAlignment = useCallback(() => {
    setActiveStep('INSPECT_ALIGNMENT');
  }, [setActiveStep]);

  const onClickDownloadConsensus = useCallback(() => {
    ExportUtil.downloadFastaFile(consensusResult.consensusFasta, 'merged_consensus.fasta');
  }, [consensusResult.consensusFasta]);

  const onClickProceedToUpload = useCallback(() => {
    setActiveStep('UPLOAD_COMBINED');
  }, [setActiveStep]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        height: '100%',
        overflow: 'auto',
        p: 2,
      }}
    >
      {/* Top Action & Merge Summary Bar */}
      <Paper
        sx={{
          alignItems: { md: 'center', xs: 'flex-start' },
          borderRadius: 2,
          display: 'flex',
          flexDirection: { md: 'row', xs: 'column' },
          gap: 1.5,
          justifyContent: 'space-between',
          p: 2,
        }}
        variant={'outlined'}
      >
        <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            onClick={onClickBackToAlignment}
            size={'small'}
            startIcon={<ArrowBackIcon />}
            variant={'outlined'}
          >
            {'Back to Alignment'}
          </Button>
          <Chip
            color={'primary'}
            label={`${consensusResult.selectedIds.length} Records Merged`}
            size={'small'}
          />
          <Chip
            label={`Reference: ${alignmentResult.referenceId} (${alignmentResult.referenceLength.toLocaleString()} bp)`}
            size={'small'}
            variant={'outlined'}
          />
          <Chip
            label={`Consensus: ${consensusResult.consensusSequence.length.toLocaleString()} bp`}
            size={'small'}
            variant={'outlined'}
          />
          <Chip
            label={`Mode: ${consensusResult.params.mode} (-d ${consensusResult.params.minDepth})`}
            size={'small'}
            variant={'outlined'}
          />
          <Chip
            label={`Called in ${consensusResult.executionTimeMs} ms`}
            size={'small'}
            variant={'outlined'}
          />
        </Box>
        <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            onClick={onClickDownloadConsensus}
            size={'small'}
            startIcon={<FileDownloadOutlinedIcon />}
            variant={'outlined'}
          >
            {'Download Consensus FASTA'}
          </Button>
          <Button
            color={'primary'}
            endIcon={<ArrowForwardIcon />}
            onClick={onClickProceedToUpload}
            size={'small'}
            variant={'contained'}
          >
            {'Next: Upload Combined Record'}
          </Button>
        </Box>
      </Paper>
      {/* Consensus Sequence & Selected Records / Metadata Summary */}
      <Box sx={{ display: 'grid', flex: 1, gap: 2, gridTemplateColumns: { lg: '1fr 1.25fr', xs: '1fr' }, minHeight: 0 }}>
        <Paper
          sx={{ borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 1.5, p: 2 }}
          variant={'outlined'}
        >
          <Typography
            sx={{ fontWeight: 700 }}
            variant={'subtitle1'}
          >
            {'Called Consensus Sequence'}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            <Chip
              label={`A: ${baseCounts.a}`}
              size={'small'}
              variant={'outlined'}
            />
            <Chip
              label={`C: ${baseCounts.c}`}
              size={'small'}
              variant={'outlined'}
            />
            <Chip
              label={`G: ${baseCounts.g}`}
              size={'small'}
              variant={'outlined'}
            />
            <Chip
              label={`T: ${baseCounts.t}`}
              size={'small'}
              variant={'outlined'}
            />
            <Chip
              color={baseCounts.other > 0 ? 'warning' : 'default'}
              label={`N / Ambiguous: ${baseCounts.other}`}
              size={'small'}
              variant={'outlined'}
            />
          </Box>
          <Box
            component={'pre'}
            sx={{
              backgroundColor: 'action.hover',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              flex: 1,
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              m: 0,
              maxHeight: 440,
              minHeight: 240,
              overflow: 'auto',
              p: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {consensusResult.consensusFasta}
          </Box>
        </Paper>
        <Paper
          sx={{ borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 1.5, overflow: 'hidden', p: 2 }}
          variant={'outlined'}
        >
          <Typography
            sx={{ fontWeight: 700 }}
            variant={'subtitle1'}
          >
            {'Source Records & Metadata Summary'}
          </Typography>
          <TableContainer sx={{ flex: 1, maxHeight: 480 }}>
            <Table
              size={'small'}
              stickyHeader
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {'Sequence ID'}
                  </TableCell>
                  <TableCell
                    align={'right'}
                    sx={{ fontWeight: 700 }}
                  >
                    {'Length (bp)'}
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
                {consensusResult.selectedIds.map((id) => {
                  const metaRec = MetaDataUtil.getRecordForSample(parsedMetadata, id, matchKeyField);
                  const seqLength = sequenceMap.get(id);
                  return (
                    <TableRow
                      hover
                      key={id}
                    >
                      <TableCell>
                        <Typography
                          sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                          variant={'body2'}
                        >
                          {id}
                        </Typography>
                      </TableCell>
                      <TableCell align={'right'}>
                        <Typography
                          sx={{ fontFamily: 'monospace' }}
                          variant={'body2'}
                        >
                          {seqLength !== undefined ? seqLength.toLocaleString() : '—'}
                        </Typography>
                      </TableCell>
                      {visibleMetadataColumns.map((col) => (
                        <TableCell key={col}>
                          <Typography
                            noWrap
                            sx={{ maxWidth: 160 }}
                            variant={'body2'}
                          >
                            {metaRec?.[col] || '—'}
                          </Typography>
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Box>
  );
};

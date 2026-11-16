import type { ChangeEvent } from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Alert,
  Box,
  Button,
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
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { container } from 'tsyringe';
import { useStore } from 'zustand';
import { LoculusService } from '@rivm-loculus-tools/common-frontend/classes/services/LoculusService';
import { UrlService } from '@rivm-loculus-tools/common-frontend/classes/services/UrlService';
import type { UrlParams } from '@rivm-loculus-tools/common-frontend/models/url.models';
import { ExportUtil } from '@rivm-loculus-tools/common-frontend/utils/ExportUtil';
import { MetaDataUtil } from '@rivm-loculus-tools/common-frontend/utils/MetaDataUtil';

import type { ConsensusResult } from '../../../models/pipeline.models';
import { recordMergerStore } from '../../../stores/recordMergerStore';

import { CombinedMetadataField } from './CombinedMetadataField';

export type UploadCombinedRecordViewProps = {
  consensusResult: ConsensusResult;
};

const DEFAULT_METADATA_COLUMNS = [
  'accessionVersion',
  'SampleID',
  'groupId',
  'country',
  'region',
  'host',
  'collectionDate',
];

const ID_COLUMN_NAMES = new Set(['accession', 'accessionversion', 'id', 'sample_id', 'sampleid']);
const EMPTY_URL_PARAMS: UrlParams = {};

const sanitizeTsvCell = (value: string): string => value.replace(/[\t\r\n]+/g, ' ').trim();

export const UploadCombinedRecordView = ({ consensusResult }: UploadCombinedRecordViewProps) => {
  const loculusService = useMemo(() => container.resolve(LoculusService), []);
  const urlService = useMemo(() => container.resolve(UrlService), []);

  const isAuthenticated = useSyncExternalStore(
    useCallback((onStoreChange) => loculusService.subscribe(onStoreChange), [loculusService]),
    useCallback(() => loculusService.data.authenticated, [loculusService]),
    () => false,
  );

  const urlData = useSyncExternalStore<UrlParams>(
    useCallback((onStoreChange) => urlService.subscribe(onStoreChange), [urlService]),
    useCallback(() => urlService.data, [urlService]),
    () => EMPTY_URL_PARAMS,
  );

  const hasReturnParams = Boolean(urlData.returnUrl && urlData.organism);

  const parsedMetadata = useStore(recordMergerStore, (state) => state.parsedMetadata);
  const matchKeyField = useStore(recordMergerStore, (state) => state.matchKeyField);
  const setActiveStep = useStore(recordMergerStore, (state) => state.setActiveStep);

  const defaultCombinedId = useMemo(
    () => `merged_consensus_${consensusResult.selectedIds.length}_records`,
    [consensusResult.selectedIds.length],
  );

  const columns = useMemo(() => (
    parsedMetadata?.columns && parsedMetadata.columns.length > 0
      ? parsedMetadata.columns
      : DEFAULT_METADATA_COLUMNS
  ), [parsedMetadata]);

  const sourceValuesByColumn = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of columns) {
      const seen = new Set<string>();
      for (const id of consensusResult.selectedIds) {
        const rec = MetaDataUtil.getRecordForSample(parsedMetadata, id, matchKeyField);
        const val = rec?.[col]?.trim();
        if (val) {
          seen.add(val);
        }
      }
      map[col] = Array.from(seen);
    }
    return map;
  }, [columns, consensusResult.selectedIds, matchKeyField, parsedMetadata]);

  const buildInitialMetadataValues = useCallback((recordId: string) => {
    const initial: Record<string, string> = {};
    for (const col of columns) {
      const lowerCol = col.toLowerCase();
      if (ID_COLUMN_NAMES.has(lowerCol)) {
        initial[col] = recordId;
      } else {
        const values = sourceValuesByColumn[col] ?? [];
        initial[col] = values.length === 1 ? values[0] : '';
      }
    }
    return initial;
  }, [columns, sourceValuesByColumn]);

  const [combinedRecordId, setCombinedRecordId] = useState(defaultCombinedId);
  const [dataUseTermsType, setDataUseTermsType] = useState<'OPEN' | 'RESTRICTED'>('OPEN');
  const [metadataValues, setMetadataValues] = useState<Record<string, string>>(
    () => buildInitialMetadataValues(defaultCombinedId),
  );
  const [isUploading, setIsUploading] = useState(false);
  const [didUpload, setDidUpload] = useState(false);
  const [uploadError, setUploadError] = useState<null | string>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setCombinedRecordId(defaultCombinedId);
    setMetadataValues(buildInitialMetadataValues(defaultCombinedId));
    setDidUpload(false);
    setUploadError(null);
  }, [buildInitialMetadataValues, defaultCombinedId]);

  useEffect(() => () => {
    abortControllerRef.current?.abort();
  }, []);

  const sanitizedRecordId = combinedRecordId.trim().replace(/\s+/g, '_') || defaultCombinedId;
  const combinedFasta = useMemo(
    () => `>${sanitizedRecordId} reference=${consensusResult.referenceId} merged_records=${consensusResult.selectedIds.length}\n${consensusResult.consensusSequence}\n`,
    [consensusResult.consensusSequence, consensusResult.referenceId, consensusResult.selectedIds.length, sanitizedRecordId],
  );

  const combinedMetadataTsv = useMemo(() => {
    const headerRow = columns.join('\t');
    const valueRow = columns.map((col) => sanitizeTsvCell(metadataValues[col] ?? '')).join('\t');
    return `${headerRow}\n${valueRow}\n`;
  }, [columns, metadataValues]);

  const resolvedGroupId = useMemo(() => {
    const explicitGroupId = metadataValues.groupId?.trim();
    if (explicitGroupId) {
      return explicitGroupId;
    }
    return parsedMetadata ? MetaDataUtil.getGroupId(parsedMetadata) : '';
  }, [metadataValues.groupId, parsedMetadata]);

  const onChangeCombinedRecordId = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextId = event.target.value;
    const trimmedPrevId = combinedRecordId.trim();
    const trimmedNextId = nextId.trim();
    setCombinedRecordId(nextId);
    setMetadataValues((prevValues) => {
      const updated = { ...prevValues };
      for (const col of columns) {
        if (ID_COLUMN_NAMES.has(col.toLowerCase()) && prevValues[col] === trimmedPrevId) {
          updated[col] = trimmedNextId;
        }
      }
      return updated;
    });
  }, [columns, combinedRecordId]);

  const onChangeDataUseTermsType = useCallback((event: SelectChangeEvent) => {
    setDataUseTermsType(event.target.value === 'RESTRICTED' ? 'RESTRICTED' : 'OPEN');
  }, []);

  const onChangeMetadataValue = useCallback((column: string, value: string) => {
    setMetadataValues((prev) => ({
      ...prev,
      [column]: value,
    }));
  }, []);

  const onClickBackToReview = useCallback(() => {
    setActiveStep('REVIEW_MERGE');
  }, [setActiveStep]);

  const onClickDownloadFasta = useCallback(() => {
    ExportUtil.downloadFastaFile(combinedFasta, `${sanitizedRecordId}.fasta`);
  }, [combinedFasta, sanitizedRecordId]);

  const onClickDownloadTsv = useCallback(() => {
    ExportUtil.downloadTsvFile(combinedMetadataTsv, `${sanitizedRecordId}_metadata.tsv`);
  }, [combinedMetadataTsv, sanitizedRecordId]);

  const onClickCloseTab = useCallback(() => {
    window.close();
  }, []);

  const onClickCancelUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsUploading(false);
  }, []);

  const onClickUploadToLoculus = useCallback(async () => {
    if (!urlData.returnUrl || !urlData.organism || !isAuthenticated) {
      return;
    }

    setUploadError(null);
    setDidUpload(false);
    setIsUploading(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await loculusService.submitCombinedSequence({
        abortController,
        dataUseTermsType,
        fasta: combinedFasta,
        groupId: resolvedGroupId || undefined,
        metadataTsv: combinedMetadataTsv,
        organism: urlData.organism,
        returnUrl: urlData.returnUrl,
      });
      setDidUpload(true);
    } catch (error: unknown) {
      if (!abortController.signal.aborted) {
        setUploadError(error instanceof Error ? error.message : 'Failed to upload combined record to Loculus.');
      }
    } finally {
      if (!abortController.signal.aborted) {
        abortControllerRef.current = null;
        setIsUploading(false);
      }
    }
  }, [
    combinedFasta,
    combinedMetadataTsv,
    dataUseTermsType,
    isAuthenticated,
    loculusService,
    resolvedGroupId,
    urlData.organism,
    urlData.returnUrl,
  ]);

  const canUploadToLoculus = isAuthenticated && hasReturnParams && !isUploading && !didUpload && Boolean(sanitizedRecordId);

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
      {/* Top Action & Upload Bar */}
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
            onClick={onClickBackToReview}
            size={'small'}
            startIcon={<ArrowBackIcon />}
            variant={'outlined'}
          >
            {'Back to Review Merge'}
          </Button>
          <Chip
            color={'primary'}
            label={`1 Combined Record (${consensusResult.consensusSequence.length.toLocaleString()} bp)`}
            size={'small'}
          />
          <Chip
            label={`From ${consensusResult.selectedIds.length} source records`}
            size={'small'}
            variant={'outlined'}
          />
          {hasReturnParams && (
            <Chip
              color={'info'}
              label={`Target: ${urlData.organism} (${urlData.returnUrl})`}
              size={'small'}
              variant={'outlined'}
            />
          )}
        </Box>
        <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            onClick={onClickDownloadFasta}
            size={'small'}
            startIcon={<FileDownloadOutlinedIcon />}
            variant={'outlined'}
          >
            {'Download FASTA'}
          </Button>
          <Button
            onClick={onClickDownloadTsv}
            size={'small'}
            startIcon={<FileDownloadOutlinedIcon />}
            variant={'outlined'}
          >
            {'Download Metadata TSV'}
          </Button>
          {isUploading && (
            <Button
              onClick={onClickCancelUpload}
              size={'small'}
              variant={'outlined'}
            >
              {'Cancel Upload'}
            </Button>
          )}
          {didUpload ? (
            <Button
              color={'success'}
              onClick={onClickCloseTab}
              size={'small'}
              variant={'contained'}
            >
              {'Close Tab'}
            </Button>
          ) : (
            <Button
              color={'primary'}
              disabled={!canUploadToLoculus}
              onClick={onClickUploadToLoculus}
              size={'small'}
              startIcon={isUploading ? (
                <CircularProgress
                  color={'inherit'}
                  size={16}
                />
              ) : <CloudUploadOutlinedIcon />}
              variant={'contained'}
            >
              {isUploading ? 'Uploading...' : 'Upload Combined Record to Loculus'}
            </Button>
          )}
        </Box>
      </Paper>
      {!hasReturnParams && (
        <Alert severity={'info'}>
          {'No Loculus target parameters (return-url and organism) were provided in the URL. Direct Loculus submission is disabled, but you can edit and download the combined FASTA and metadata TSV files below.'}
        </Alert>
      )}
      {hasReturnParams && !isAuthenticated && (
        <Alert severity={'warning'}>
          {'You are not authenticated with Loculus (Keycloak). Log in through Loculus to enable direct upload, or download the combined FASTA and metadata TSV files locally.'}
        </Alert>
      )}
      {uploadError && (
        <Alert severity={'error'}>
          {uploadError}
        </Alert>
      )}
      {didUpload && (
        <Alert severity={'success'}>
          {'The combined consensus sequence and metadata have been submitted to Loculus. You can close this tab.'}
        </Alert>
      )}
      {/* Metadata Editor & Payload Preview */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { lg: '1fr 1.1fr', xs: '1fr' } }}>
        <Paper
          sx={{ borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}
          variant={'outlined'}
        >
          <Box>
            <Typography
              sx={{ fontWeight: 700 }}
              variant={'subtitle1'}
            >
              {'Combined Record Identity & Metadata'}
            </Typography>
            <Typography
              color={'text.secondary'}
              variant={'caption'}
            >
              {'Review or edit the combined sequence ID and metadata fields. Shared values across selected source records are pre-filled.'}
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { sm: '1fr 180px', xs: '1fr' } }}>
            <TextField
              fullWidth
              helperText={'Used as the FASTA header identifier for the combined sequence'}
              label={'Combined Sequence ID'}
              onChange={onChangeCombinedRecordId}
              size={'small'}
              value={combinedRecordId}
            />
            <FormControl size={'small'}>
              <InputLabel id={'data-use-terms-label'}>
                {'Data Use Terms'}
              </InputLabel>
              <Select
                label={'Data Use Terms'}
                labelId={'data-use-terms-label'}
                onChange={onChangeDataUseTermsType}
                value={dataUseTermsType}
              >
                <MenuItem value={'OPEN'}>
                  {'OPEN'}
                </MenuItem>
                <MenuItem value={'RESTRICTED'}>
                  {'RESTRICTED'}
                </MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { sm: '1fr 1fr', xs: '1fr' } }}>
            {columns.map((col) => (
              <CombinedMetadataField
                column={col}
                key={col}
                onChangeValue={onChangeMetadataValue}
                sourceValues={sourceValuesByColumn[col] ?? []}
                value={metadataValues[col] ?? ''}
              />
            ))}
          </Box>
        </Paper>
        <Paper
          sx={{ borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', p: 2 }}
          variant={'outlined'}
        >
          <Typography
            sx={{ fontWeight: 700 }}
            variant={'subtitle1'}
          >
            {'Submission Payload Preview'}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography
              sx={{ fontWeight: 600 }}
              variant={'caption'}
            >
              {'metadata.tsv (1 row)'}
            </Typography>
            <TableContainer
              component={Paper}
              sx={{ overflowX: 'auto' }}
              variant={'outlined'}
            >
              <Table size={'small'}>
                <TableHead>
                  <TableRow>
                    {columns.map((col) => (
                      <TableCell
                        key={col}
                        sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                      >
                        {col}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    {columns.map((col) => (
                      <TableCell
                        key={col}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        {sanitizeTsvCell(metadataValues[col] ?? '') || '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          <Box sx={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 1 }}>
            <Typography
              sx={{ fontWeight: 600 }}
              variant={'caption'}
            >
              {'sequences.fasta'}
            </Typography>
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
                maxHeight: 260,
                minHeight: 160,
                overflow: 'auto',
                p: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {combinedFasta}
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

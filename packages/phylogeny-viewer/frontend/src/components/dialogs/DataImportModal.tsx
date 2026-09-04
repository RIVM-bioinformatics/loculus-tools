import type {
  ChangeEvent,
  SyntheticEvent,
} from 'react';
import {
  useCallback,
  useState,
} from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DnaIcon from '@mui/icons-material/Biotech';
import TableChartIcon from '@mui/icons-material/TableChart';

import { FileDropZone } from '../common/FileDropZone';
import { useDatasetStore } from '../../stores/datasetStore';
import { useCalculationStore } from '../../stores/calculationStore';
import { useTreeViewStore } from '../../stores/treeViewStore';
import { useMetadataStore } from '../../stores/metadataStore';

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const DataImportModal = () => {
  const open = useTreeViewStore((state) => state.importModalOpen);
  const setOpen = useTreeViewStore((state) => state.setImportModalOpen);

  const setFastaContent = useDatasetStore((state) => state.setFastaContent);
  const setMetadataContent = useDatasetStore((state) => state.setMetadataContent);
  const calculateTree = useCalculationStore((state) => state.calculateTree);
  const setColorByField = useMetadataStore((state) => state.setColorByField);

  // FASTA state
  const [fastaTab, setFastaTab] = useState(0); // 0: Drop, 1: URL, 2: Paste
  const [fastaFile, setFastaFile] = useState<File | null>(null);
  const [fastaUrl, setFastaUrl] = useState('');
  const [fastaText, setFastaText] = useState('');

  // Metadata state
  const [metadataTab, setMetadataTab] = useState(0); // 0: Drop, 1: URL, 2: Paste
  const [metadataFile, setMetadataFile] = useState<File | null>(null);
  const [metadataUrl, setMetadataUrl] = useState('');
  const [metadataText, setMetadataText] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<null | string>(null);

  const onCloseDialog = useCallback(() => {
    if (!isLoading) {
      setOpen(false);
      setErrorMsg(null);
    }
  }, [isLoading, setOpen]);

  const onClickClose = useCallback(() => {
    if (!isLoading) {
      setOpen(false);
      setErrorMsg(null);
    }
  }, [isLoading, setOpen]);

  const onCloseError = useCallback(() => setErrorMsg(null), []);
  const onChangeFastaTab = useCallback((_event: SyntheticEvent, value: number) => {
    setFastaTab(value);
  }, []);
  const onChangeMetadataTab = useCallback((_event: SyntheticEvent, value: number) => {
    setMetadataTab(value);
  }, []);
  const onFileSelectedFasta = useCallback((file: File) => setFastaFile(file), []);
  const onFileSelectedMetadata = useCallback((file: File) => setMetadataFile(file), []);
  const onChangeFastaUrl = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFastaUrl(event.target.value);
  }, []);
  const onChangeFastaText = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFastaText(event.target.value);
  }, []);
  const onChangeMetadataUrl = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setMetadataUrl(event.target.value);
  }, []);
  const onChangeMetadataText = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setMetadataText(event.target.value);
  }, []);

  const onClickLoadData = useCallback(async () => {
    setErrorMsg(null);
    setIsLoading(true);

    try {
      // 1. Resolve FASTA content
      let fastaContent = '';
      if (fastaTab === 0 && fastaFile) {
        fastaContent = await fastaFile.text();
      } else if (fastaTab === 1 && fastaUrl.trim()) {
        const res = await fetch(fastaUrl.trim());
        if (!res.ok) {
          throw new Error(`Failed to fetch FASTA from URL (${res.status} ${res.statusText})`);
        }
        fastaContent = await res.text();
      } else if (fastaTab === 2 && fastaText.trim()) {
        fastaContent = fastaText.trim();
      }

      if (!fastaContent?.trim()) {
        throw new Error('Please provide FASTA sequence data via file, URL, or paste.');
      }

      // 2. Resolve Metadata content (optional)
      let metadataContent = '';
      if (metadataTab === 0 && metadataFile) {
        metadataContent = await metadataFile.text();
      } else if (metadataTab === 1 && metadataUrl.trim()) {
        const res = await fetch(metadataUrl.trim());
        if (!res.ok) {
          throw new Error(`Failed to fetch Metadata from URL (${res.status} ${res.statusText})`);
        }
        metadataContent = await res.text();
      } else if (metadataTab === 2 && metadataText.trim()) {
        metadataContent = metadataText.trim();
      }

      // 3. Parse & Validate FASTA
      const fastaResult = setFastaContent(fastaContent);
      if (!fastaResult.isAligned) {
        // Alignment error will be shown by AlignmentErrorDialog
        setIsLoading(false);
        setOpen(false);
        return;
      }

      // 4. Parse Metadata
      if (metadataContent) {
        const metaResult = setMetadataContent(metadataContent);
        if (metaResult.columns.length > 0) {
          // Default color by first non-ID column if available
          const preferredCols = ['country', 'region', 'host', 'division', 'lineage', 'clade'];
          const matched = metaResult.columns.find((c) => preferredCols.includes(c.toLowerCase()));
          const defaultField = matched || metaResult.columns.find((c) => c !== 'accessionVersion' && c !== 'SampleID' && c !== 'id') || metaResult.columns[0];
          if (defaultField) {
            const vals = metaResult.records.map((r) => r[defaultField] || '');
            const uniqueVals = Array.from(new Set(vals.filter(Boolean)));
            setColorByField(defaultField, uniqueVals, vals);
          }
        }
      }

      // 5. Calculate default tree
      setOpen(false);
      await calculateTree(fastaContent);
    } catch (err: unknown) {
      console.error('Data import failed:', err);
      setErrorMsg(getErrorMessage(err, 'Failed to load dataset.'));
    } finally {
      setIsLoading(false);
    }
  }, [
    calculateTree,
    fastaFile,
    fastaTab,
    fastaText,
    fastaUrl,
    metadataFile,
    metadataTab,
    metadataText,
    metadataUrl,
    setColorByField,
    setFastaContent,
    setMetadataContent,
    setOpen,
  ]);

  const onClickLoadDemoData = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const [fastaRes, metaRes] = await Promise.all([
        fetch('/sample-data/sarscov2_aligned.fasta'),
        fetch('/sample-data/sarscov2_metadata.tsv'),
      ]);
      const demoFastaText = await fastaRes.text();
      const demoMetadataText = await metaRes.text();

      setFastaContent(demoFastaText);
      const metaResult = setMetadataContent(demoMetadataText);
      if (metaResult.columns.length > 0) {
        const field = 'country';
        const vals = metaResult.records.map((r) => r[field] || '');
        const uniqueVals = Array.from(new Set(vals.filter(Boolean)));
        setColorByField(field, uniqueVals, vals);
      }
      setOpen(false);
      await calculateTree(demoFastaText);
    } catch (err: unknown) {
      setErrorMsg(`Failed to load demo dataset: ${getErrorMessage(err, 'Unknown error')}`);
    } finally {
      setIsLoading(false);
    }
  }, [calculateTree, setColorByField, setFastaContent, setMetadataContent, setOpen]);

  return (
    <Dialog
      fullWidth
      maxWidth={'lg'}
      onClose={onCloseDialog}
      open={open}
    >
      <DialogTitle sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
        <Typography
          sx={{ fontWeight: 700 }}
          variant={'h6'}
        >
          {'Load Phylogenetic Data'}
        </Typography>
        <IconButton
          disabled={isLoading}
          onClick={onClickClose}
          size={'small'}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 3 }}
      >
        {errorMsg && (
          <Alert
            onClose={onCloseError}
            severity={'error'}
          >
            {errorMsg}
          </Alert>
        )}
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { md: '1fr 1fr', xs: '1fr' } }}>
          {/* FASTA Sequences Group */}
          <Paper
            sx={{ borderRadius: 2, p: 2.5 }}
            variant={'outlined'}
          >
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1, mb: 1.5 }}>
              <DnaIcon color={'primary'} />
              <Typography
                sx={{ fontWeight: 700 }}
                variant={'subtitle1'}
              >
                {'1. FASTA Sequences (Required)'}
              </Typography>
            </Box>
            <Typography
              color={'text.secondary'}
              sx={{ display: 'block', mb: 2 }}
              variant={'caption'}
            >
              {'Pre-aligned nucleotide or amino-acid sequence data.'}
            </Typography>
            <Tabs
              onChange={onChangeFastaTab}
              sx={{ mb: 2, minHeight: 36 }}
              value={fastaTab}
            >
              <Tab
                label={'File Upload'}
                sx={{ fontSize: '0.85rem', py: 0.5 }}
              />
              <Tab
                label={'Public URL'}
                sx={{ fontSize: '0.85rem', py: 0.5 }}
              />
              <Tab
                label={'Direct Paste'}
                sx={{ fontSize: '0.85rem', py: 0.5 }}
              />
            </Tabs>
            {fastaTab === 0 && (
              <FileDropZone
                accept={'.fasta,.fa,.fna,.aln'}
                file={fastaFile}
                helperText={'Drag & drop .fasta / .fa alignment file'}
                label={'FASTA File'}
                onFileSelected={onFileSelectedFasta}
              />
            )}
            {fastaTab === 1 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, justifyContent: 'center', minHeight: 180 }}>
                <TextField
                  fullWidth
                  helperText={'Enter a publicly accessible URL to a FASTA alignment'}
                  label={'FASTA URL'}
                  onChange={onChangeFastaUrl}
                  placeholder={'https://example.com/sequences.fasta'}
                  value={fastaUrl}
                  variant={'outlined'}
                />
              </Box>
            )}
            {fastaTab === 2 && (
              <Box sx={{ minHeight: 180 }}>
                <TextField
                  fullWidth
                  label={'Paste FASTA Content'}
                  multiline
                  onChange={onChangeFastaText}
                  placeholder={'>seq1&#10;ACTG...&#10;>seq2&#10;ACTG...'}
                  rows={6}
                  sx={{ fontFamily: 'monospace' }}
                  value={fastaText}
                  variant={'outlined'}
                />
              </Box>
            )}
          </Paper>
          {/* TSV Metadata Group */}
          <Paper
            sx={{ borderRadius: 2, p: 2.5 }}
            variant={'outlined'}
          >
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1, mb: 1.5 }}>
              <TableChartIcon color={'secondary'} />
              <Typography
                sx={{ fontWeight: 700 }}
                variant={'subtitle1'}
              >
                {'2. TSV Metadata (Optional)'}
              </Typography>
            </Box>
            <Typography
              color={'text.secondary'}
              sx={{ display: 'block', mb: 2 }}
              variant={'caption'}
            >
              {'Sample attributes for coloring, search & custom leaf labels.'}
            </Typography>
            <Tabs
              onChange={onChangeMetadataTab}
              sx={{ mb: 2, minHeight: 36 }}
              value={metadataTab}
            >
              <Tab
                label={'File Upload'}
                sx={{ fontSize: '0.85rem', py: 0.5 }}
              />
              <Tab
                label={'Public URL'}
                sx={{ fontSize: '0.85rem', py: 0.5 }}
              />
              <Tab
                label={'Direct Paste'}
                sx={{ fontSize: '0.85rem', py: 0.5 }}
              />
            </Tabs>
            {metadataTab === 0 && (
              <FileDropZone
                accept={'.tsv,.txt,.csv'}
                file={metadataFile}
                helperText={'Drag & drop .tsv / .csv metadata file'}
                label={'TSV Metadata File'}
                onFileSelected={onFileSelectedMetadata}
              />
            )}
            {metadataTab === 1 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, justifyContent: 'center', minHeight: 180 }}>
                <TextField
                  fullWidth
                  helperText={'Enter a publicly accessible URL to a TSV metadata file'}
                  label={'Metadata TSV URL'}
                  onChange={onChangeMetadataUrl}
                  placeholder={'https://example.com/metadata.tsv'}
                  value={metadataUrl}
                  variant={'outlined'}
                />
              </Box>
            )}
            {metadataTab === 2 && (
              <Box sx={{ minHeight: 180 }}>
                <TextField
                  fullWidth
                  label={'Paste TSV Content'}
                  multiline
                  onChange={onChangeMetadataText}
                  placeholder={'SampleID&#9;Country&#9;Date&#10;Sample1&#9;NL&#9;2024-01-01'}
                  rows={6}
                  sx={{ fontFamily: 'monospace' }}
                  value={metadataText}
                  variant={'outlined'}
                />
              </Box>
            )}
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', p: 2.5 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            color={'inherit'}
            disabled={isLoading}
            onClick={onClickClose}
          >
            {'Cancel'}
          </Button>
          <Button
            color={'secondary'}
            disabled={isLoading}
            onClick={onClickLoadDemoData}
            size={'small'}
            variant={'outlined'}
          >
            {'Demo (SARS-CoV-2)'}
          </Button>
          {/* <Button
            onClick={handleLoadRSVDemoData}
            disabled={isLoading}
            variant="outlined"
            color="primary"
            size="small"
          >
            Demo (RSV-A, 279 Taxa)
          </Button> */}
        </Box>
        <Button
          color={'primary'}
          disabled={isLoading}
          onClick={onClickLoadData}
          startIcon={isLoading ? (
            <CircularProgress
              color={'inherit'}
              size={18}
            />
          ) : undefined}
          sx={{ minWidth: 140, py: 1 }}
          variant={'contained'}
        >
          {isLoading ? 'Processing...' : 'Load & Calculate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

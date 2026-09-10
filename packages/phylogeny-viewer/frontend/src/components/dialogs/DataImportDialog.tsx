import type {
  ChangeEvent,
  ReactElement,
  SyntheticEvent,
} from 'react';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import DnaIcon from '@mui/icons-material/Biotech';
import TableChartIcon from '@mui/icons-material/TableChart';
import { FileDropZone } from '@gen-epix/ui-core-components/components/FileDropZone';
import type {
  WithDialogRefMethods,
  WithDialogRenderProps,
} from '@gen-epix/ui-core-components/hoc/withDialog';
import { withDialog } from '@gen-epix/ui-core-components/hoc/withDialog';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import { useStore } from 'zustand';

import { datasetStore } from '../../stores/datasetStore';
import { calculationStore } from '../../stores/calculationStore';
import { metadataStore } from '../../stores/metadataStore';
import { EventBusService } from '../../services/EventBusService';


enum FASTA_TAB {
  DROP = 0,
  URL = 1,
  PASTE = 2,
}

enum META_DATA_TAB {
  DROP = 0,
  URL = 1,
  PASTE = 2,
}

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export interface DataImportDialogOpenProps {
  //
}

export interface DataImportDialogProps extends WithDialogRenderProps<DataImportDialogOpenProps> {
  //
}

export type DataImportDialogRefMethods = WithDialogRefMethods<DataImportDialogProps, DataImportDialogOpenProps>;

export const DataImportDialog = withDialog<DataImportDialogProps, DataImportDialogOpenProps>((
  {
    onActionsChange,
    onClose,
  }: DataImportDialogProps,
): ReactElement => {
  const setFastaContent = useStore(datasetStore, (state) => state.setFastaContent);
  const setMetadataContent = useStore(datasetStore, (state) => state.setMetadataContent);
  const calculateTree = useStore(calculationStore, (state) => state.calculateTree);
  const setColorByField = useStore(metadataStore, (state) => state.setColorByField);

  // FASTA state
  const [fastaTab, setFastaTab] = useState(FASTA_TAB.DROP);
  const [fastaFile, setFastaFile] = useState<FileList | null>(null);
  const [fastaUrl, setFastaUrl] = useState('');
  const [fastaText, setFastaText] = useState('');

  // Metadata state
  const [metadataTab, setMetadataTab] = useState(META_DATA_TAB.DROP);
  const [metadataFile, setMetadataFile] = useState<FileList | null>(null);
  const [metadataUrl, setMetadataUrl] = useState('');
  const [metadataText, setMetadataText] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<null | string>(null);

  const onCloseError = useCallback(() => setErrorMsg(null), []);
  const onChangeFastaTab = useCallback((_event: SyntheticEvent, value: number) => {
    setFastaTab(value);
  }, []);
  const onChangeMetadataTab = useCallback((_event: SyntheticEvent, value: number) => {
    setMetadataTab(value);
  }, []);
  const onFileSelectedFasta = useCallback((file: FileList) => setFastaFile(file), []);
  const onFileSelectedMetadata = useCallback((file: FileList) => setMetadataFile(file), []);
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
      if (fastaTab === FASTA_TAB.DROP && fastaFile) {
        fastaContent = await fastaFile[0].text();
      } else if (fastaTab === FASTA_TAB.URL && fastaUrl.trim()) {
        const res = await fetch(fastaUrl.trim());
        if (!res.ok) {
          throw new Error(`Failed to fetch FASTA from URL (${res.status} ${res.statusText})`);
        }
        fastaContent = await res.text();
      } else if (fastaTab === FASTA_TAB.PASTE && fastaText.trim()) {
        fastaContent = fastaText.trim();
      }

      if (!fastaContent?.trim()) {
        throw new Error('Please provide FASTA sequence data via file, URL, or paste.');
      }

      // 2. Resolve Metadata content (optional)
      let metadataContent = '';
      if (metadataTab === META_DATA_TAB.DROP && metadataFile) {
        metadataContent = await metadataFile[0].text();
      } else if (metadataTab === META_DATA_TAB.URL && metadataUrl.trim()) {
        const res = await fetch(metadataUrl.trim());
        if (!res.ok) {
          throw new Error(`Failed to fetch Metadata from URL (${res.status} ${res.statusText})`);
        }
        metadataContent = await res.text();
      } else if (metadataTab === META_DATA_TAB.PASTE && metadataText.trim()) {
        metadataContent = metadataText.trim();
      }

      // 3. Parse & Validate FASTA
      const fastaResult = setFastaContent(fastaContent);
      if (!fastaResult.isAligned) {
        onClose();
        EventBusService.getInstance().emit('onShowAlignmentErrorDialog');
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
      onClose();
      await calculateTree(fastaContent);
    } catch (err: unknown) {
      console.error('Data import failed:', err);
      setErrorMsg(getErrorMessage(err, 'Failed to load dataset.'));
    } finally {
      setIsLoading(false);
    }
  }, [calculateTree, fastaFile, fastaTab, fastaText, fastaUrl, metadataFile, metadataTab, metadataText, metadataUrl, onClose, setColorByField, setFastaContent, setMetadataContent]);

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
      onClose();
      await calculateTree(demoFastaText);
    } catch (err: unknown) {
      setErrorMsg(`Failed to load demo dataset: ${getErrorMessage(err, 'Unknown error')}`);
    } finally {
      setIsLoading(false);
    }
  }, [calculateTree, onClose, setColorByField, setFastaContent, setMetadataContent]);


  useEffect(() => {
    const actions: DialogAction[] = [];
    actions.push(
      {
        autoFocus: true,
        color: 'secondary',
        label: 'Demo (SARS-CoV-2)',
        onClick: onClickLoadDemoData,
        variant: 'contained',
      },
      {
        disabled: isLoading,
        label: isLoading ? 'Processing...' : 'Load & Calculate',
        onClick: onClickLoadData,
        startIcon: isLoading ? (
          <CircularProgress
            color={'inherit'}
            size={18}
          />
        ) : undefined,
        variant: 'contained',
      },
    );
    onActionsChange(actions);
  }, [onActionsChange, onClickLoadDemoData, onClickLoadData, isLoading]);

  return (
    <>
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
          {fastaTab === FASTA_TAB.DROP && (
            <FileDropZone
              accept={'.fasta,.fa,.fna,.aln'}
              files={fastaFile}
              helperText={'Drag & drop .fasta / .fa alignment file'}
              onFilesSelected={onFileSelectedFasta}
            />
          )}
          {fastaTab === FASTA_TAB.URL && (
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
          {fastaTab === FASTA_TAB.PASTE && (
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
            <TableChartIcon color={'primary'} />
            <Typography
              sx={{ fontWeight: 700 }}
              variant={'subtitle1'}
            >
              {'2. TSV Metadata (Optional)'}
            </Typography>
          </Box>
          <Typography
            color={'text.primary'}
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
          {metadataTab === META_DATA_TAB.DROP && (
            <FileDropZone
              accept={'.tsv,.txt,.csv'}
              files={metadataFile}
              label={'TSV Metadata File'}
              onFilesSelected={onFileSelectedMetadata}
            />
          )}
          {metadataTab === META_DATA_TAB.URL && (
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
          {metadataTab === META_DATA_TAB.PASTE && (
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
    </>
  );
}, {
  defaultTitle: 'Load Phylogenetic Data',
  fullWidth: true,
  maxWidth: 'xl',
  testId: 'DataImportDialog',
});

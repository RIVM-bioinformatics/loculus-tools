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

export interface FastaDataImportDialogOpenProps {
  initialErrorMessage?: string;
}

export interface FastaDataImportDialogProps extends WithDialogRenderProps<FastaDataImportDialogOpenProps> {
  extraActions?: DialogAction[];
  onDataChange: (fasta: string, metaData?: string) => void;
  onError: (error: unknown) => void;
}

export type FastaDataImportDialogRefMethods = WithDialogRefMethods<FastaDataImportDialogProps, FastaDataImportDialogOpenProps>;

export const FastaDataImportDialog = withDialog<FastaDataImportDialogProps, FastaDataImportDialogOpenProps>((
  {
    extraActions,
    onActionsChange,
    onClose,
    onDataChange,
    onDisableBackdropClickChange,
    onError,
    onNoCloseButtonChange,
    openProps,
  }: FastaDataImportDialogProps,
): ReactElement => {
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

  useEffect(() => {
    setErrorMsg(openProps?.initialErrorMessage ?? null);
  }, [openProps]);

  useEffect(() => {
    onNoCloseButtonChange(!!openProps?.initialErrorMessage);
    onDisableBackdropClickChange(!!openProps?.initialErrorMessage);
  }, [onDisableBackdropClickChange, onNoCloseButtonChange, openProps?.initialErrorMessage]);

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
      onDataChange(fastaContent, metadataContent);
      onClose();
    } catch (err: unknown) {
      console.error('Data import failed:', err);
      onError(err);
    } finally {
      setIsLoading(false);
    }
  }, [fastaFile, fastaTab, fastaText, fastaUrl, metadataFile, metadataTab, metadataText, metadataUrl, onClose, onDataChange, onError]);


  useEffect(() => {
    const actions: DialogAction[] = [
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
    ];
    if (extraActions?.length) {
      actions.unshift(...extraActions);
    }
    onActionsChange(actions);
  }, [onActionsChange, onClickLoadData, isLoading, extraActions]);

  return (
    <>
      {errorMsg && (
        <Alert
          onClose={onCloseError}
          severity={'error'}
          sx={{
            marginBottom: 2,
          }}
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
  testId: 'FastaDataImportDialog',
});

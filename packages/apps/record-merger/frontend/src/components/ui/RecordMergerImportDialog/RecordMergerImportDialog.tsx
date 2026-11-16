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
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import TableChartIcon from '@mui/icons-material/TableChart';
import { FileDropZone } from '@gen-epix/ui-core-components/components/FileDropZone';
import type {
  WithDialogRefMethods,
  WithDialogRenderProps,
} from '@gen-epix/ui-core-components/hoc/withDialog';
import { withDialog } from '@gen-epix/ui-core-components/hoc/withDialog';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import { UrlUtil } from '@rivm-loculus-tools/common-frontend/utils/UrlUtil';

enum IMPORT_TAB {
  DROP = 0,
  URL = 1,
  PASTE = 2,
}

export interface RecordMergerImportDialogOpenProps {
  initialErrorMessage?: string;
}

export interface RecordMergerImportDialogProps extends WithDialogRenderProps<RecordMergerImportDialogOpenProps> {
  extraActions?: DialogAction[];
  onDataChange: (fastaContents: string[], referenceContent: string, metadataContent?: string) => void;
  onError: (error: unknown) => void;
}

export type RecordMergerImportDialogRefMethods = WithDialogRefMethods<RecordMergerImportDialogProps, RecordMergerImportDialogOpenProps>;

const fetchTextFromUrl = async (url: string, label: string): Promise<string> => {
  const trimmedUrl = url.trim();
  if (!UrlUtil.isValidResourceUrl(trimmedUrl)) {
    throw new Error(`Invalid ${label} URL: ${trimmedUrl}`);
  }
  const response = await fetch(trimmedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${label} from URL (${response.status} ${response.statusText})`);
  }
  return await response.text();
};

export const RecordMergerImportDialog = withDialog<RecordMergerImportDialogProps, RecordMergerImportDialogOpenProps>((
  {
    extraActions,
    onActionsChange,
    onClose,
    onDataChange,
    onDisableBackdropClickChange,
    onError,
    onNoCloseButtonChange,
    openProps,
  }: RecordMergerImportDialogProps,
): ReactElement => {
  // Input FASTA sequences state (multiple files or URLs supported)
  const [fastaTab, setFastaTab] = useState(IMPORT_TAB.DROP);
  const [fastaFiles, setFastaFiles] = useState<FileList | null>(null);
  const [fastaUrlsText, setFastaUrlsText] = useState('');
  const [fastaText, setFastaText] = useState('');

  // Reference FASTA state (single required reference)
  const [referenceTab, setReferenceTab] = useState(IMPORT_TAB.DROP);
  const [referenceFile, setReferenceFile] = useState<FileList | null>(null);
  const [referenceUrl, setReferenceUrl] = useState('');
  const [referenceText, setReferenceText] = useState('');

  // Metadata state (optional TSV)
  const [metadataTab, setMetadataTab] = useState(IMPORT_TAB.DROP);
  const [metadataFile, setMetadataFile] = useState<FileList | null>(null);
  const [metadataUrl, setMetadataUrl] = useState('');
  const [metadataText, setMetadataText] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<null | string>(null);

  useEffect(() => {
    setErrorMsg(openProps?.initialErrorMessage ?? null);
  }, [openProps]);

  useEffect(() => {
    if (onNoCloseButtonChange) {
      onNoCloseButtonChange(!!openProps?.initialErrorMessage);
    }
    if (onDisableBackdropClickChange) {
      onDisableBackdropClickChange(!!openProps?.initialErrorMessage);
    }
  }, [onDisableBackdropClickChange, onNoCloseButtonChange, openProps?.initialErrorMessage]);

  const onCloseError = useCallback(() => setErrorMsg(null), []);

  const onChangeFastaTab = useCallback((_event: SyntheticEvent, value: number) => {
    setFastaTab(value);
  }, []);
  const onChangeReferenceTab = useCallback((_event: SyntheticEvent, value: number) => {
    setReferenceTab(value);
  }, []);
  const onChangeMetadataTab = useCallback((_event: SyntheticEvent, value: number) => {
    setMetadataTab(value);
  }, []);

  const onFilesSelectedFasta = useCallback((files: FileList) => setFastaFiles(files), []);
  const onFileSelectedReference = useCallback((files: FileList) => setReferenceFile(files), []);
  const onFileSelectedMetadata = useCallback((files: FileList) => setMetadataFile(files), []);

  const onChangeFastaUrlsText = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFastaUrlsText(event.target.value);
  }, []);
  const onChangeFastaText = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFastaText(event.target.value);
  }, []);
  const onChangeReferenceUrl = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setReferenceUrl(event.target.value);
  }, []);
  const onChangeReferenceText = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setReferenceText(event.target.value);
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
      // 1. Resolve one or more input FASTA contents
      let fastaContents: string[] = [];
      if (fastaTab === IMPORT_TAB.DROP && fastaFiles && fastaFiles.length > 0) {
        fastaContents = await Promise.all(Array.from(fastaFiles).map(async (file) => await file.text()));
      } else if (fastaTab === IMPORT_TAB.URL && fastaUrlsText.trim()) {
        const urls = fastaUrlsText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        fastaContents = await Promise.all(urls.map(async (url) => await fetchTextFromUrl(url, 'Input FASTA')));
      } else if (fastaTab === IMPORT_TAB.PASTE && fastaText.trim()) {
        fastaContents = [fastaText.trim()];
      }

      if (fastaContents.filter((content) => content.trim().length > 0).length === 0) {
        throw new Error('Please provide at least one input FASTA sequence file, URL, or pasted content.');
      }

      // 2. Resolve required reference sequence
      let referenceContent = '';
      if (referenceTab === IMPORT_TAB.DROP && referenceFile && referenceFile.length > 0) {
        referenceContent = await referenceFile[0].text();
      } else if (referenceTab === IMPORT_TAB.URL && referenceUrl.trim()) {
        referenceContent = await fetchTextFromUrl(referenceUrl, 'Reference FASTA');
      } else if (referenceTab === IMPORT_TAB.PASTE && referenceText.trim()) {
        referenceContent = referenceText.trim();
      }

      if (!referenceContent.trim()) {
        throw new Error('Please provide a reference FASTA sequence via file, URL, or paste.');
      }

      // 3. Resolve optional TSV metadata
      let metadataContent = '';
      if (metadataTab === IMPORT_TAB.DROP && metadataFile && metadataFile.length > 0) {
        metadataContent = await metadataFile[0].text();
      } else if (metadataTab === IMPORT_TAB.URL && metadataUrl.trim()) {
        metadataContent = await fetchTextFromUrl(metadataUrl, 'Metadata TSV');
      } else if (metadataTab === IMPORT_TAB.PASTE && metadataText.trim()) {
        metadataContent = metadataText.trim();
      }

      onDataChange(fastaContents, referenceContent, metadataContent || undefined);
      if (onClose) {
        onClose();
      }
    } catch (err: unknown) {
      console.error('[RecordMergerImportDialog] Data import failed:', err);
      onError(err);
    } finally {
      setIsLoading(false);
    }
  }, [
    fastaFiles,
    fastaTab,
    fastaText,
    fastaUrlsText,
    metadataFile,
    metadataTab,
    metadataText,
    metadataUrl,
    onClose,
    onDataChange,
    onError,
    referenceFile,
    referenceTab,
    referenceText,
    referenceUrl,
  ]);

  useEffect(() => {
    const actions: DialogAction[] = [
      {
        disabled: isLoading,
        label: isLoading ? 'Loading...' : 'Load Records & Reference',
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
    if (onActionsChange) {
      onActionsChange(actions);
    }
  }, [extraActions, isLoading, onActionsChange, onClickLoadData]);

  return (
    <>
      {errorMsg && (
        <Alert
          onClose={onCloseError}
          severity={'error'}
          sx={{ marginBottom: 2 }}
        >
          {errorMsg}
        </Alert>
      )}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { lg: '1fr 1fr 1fr', xs: '1fr' } }}>
        {/* 1. Input FASTA Sequences (multi-FASTA) */}
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
              {'1. Input FASTA Sequences (required)'}
            </Typography>
          </Box>
          <Typography
            color={'text.secondary'}
            sx={{ display: 'block', mb: 2 }}
            variant={'caption'}
          >
            {'Select one or more FASTA files containing records to inspect and merge.'}
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
              label={'Public URL(s)'}
              sx={{ fontSize: '0.85rem', py: 0.5 }}
            />
            <Tab
              label={'Direct Paste'}
              sx={{ fontSize: '0.85rem', py: 0.5 }}
            />
          </Tabs>
          {fastaTab === IMPORT_TAB.DROP && (
            <FileDropZone
              accept={'.fasta,.fa,.fna,.aln'}
              files={fastaFiles}
              helperText={'Drag & drop one or more .fasta / .fa files'}
              multiple
              onFilesSelected={onFilesSelectedFasta}
            />
          )}
          {fastaTab === IMPORT_TAB.URL && (
            <Box sx={{ minHeight: 180 }}>
              <TextField
                fullWidth
                helperText={'Enter one or more publicly accessible FASTA URLs (one per line)'}
                label={'FASTA URL(s)'}
                multiline
                onChange={onChangeFastaUrlsText}
                placeholder={'https://example.com/batch1.fasta\nhttps://example.com/batch2.fasta'}
                rows={5}
                value={fastaUrlsText}
                variant={'outlined'}
              />
            </Box>
          )}
          {fastaTab === IMPORT_TAB.PASTE && (
            <Box sx={{ minHeight: 180 }}>
              <TextField
                fullWidth
                label={'Paste Input FASTA Content'}
                multiline
                onChange={onChangeFastaText}
                placeholder={'>seq1\nACTG...\n>seq2\nACTG...'}
                rows={6}
                sx={{ fontFamily: 'monospace' }}
                value={fastaText}
                variant={'outlined'}
              />
            </Box>
          )}
        </Paper>
        {/* 2. Reference Sequence (required) */}
        <Paper
          sx={{ borderRadius: 2, p: 2.5 }}
          variant={'outlined'}
        >
          <Box sx={{ alignItems: 'center', display: 'flex', gap: 1, mb: 1.5 }}>
            <MenuBookOutlinedIcon color={'primary'} />
            <Typography
              sx={{ fontWeight: 700 }}
              variant={'subtitle1'}
            >
              {'2. Reference Sequence (required)'}
            </Typography>
          </Box>
          <Typography
            color={'text.secondary'}
            sx={{ display: 'block', mb: 2 }}
            variant={'caption'}
          >
            {'Alignment target and JBrowse2 reference (excluded from consensus calling).'}
          </Typography>
          <Tabs
            onChange={onChangeReferenceTab}
            sx={{ mb: 2, minHeight: 36 }}
            value={referenceTab}
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
          {referenceTab === IMPORT_TAB.DROP && (
            <FileDropZone
              accept={'.fasta,.fa,.fna'}
              files={referenceFile}
              helperText={'Drag & drop reference .fasta / .fa file'}
              onFilesSelected={onFileSelectedReference}
            />
          )}
          {referenceTab === IMPORT_TAB.URL && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, justifyContent: 'center', minHeight: 180 }}>
              <TextField
                fullWidth
                helperText={'Enter a publicly accessible URL to the reference genome FASTA'}
                label={'Reference FASTA URL'}
                onChange={onChangeReferenceUrl}
                placeholder={'https://example.com/reference.fasta'}
                value={referenceUrl}
                variant={'outlined'}
              />
            </Box>
          )}
          {referenceTab === IMPORT_TAB.PASTE && (
            <Box sx={{ minHeight: 180 }}>
              <TextField
                fullWidth
                label={'Paste Reference FASTA Content'}
                multiline
                onChange={onChangeReferenceText}
                placeholder={'>NC_045512.2\nATTAAAGGTTT...'}
                rows={6}
                sx={{ fontFamily: 'monospace' }}
                value={referenceText}
                variant={'outlined'}
              />
            </Box>
          )}
        </Paper>
        {/* 3. TSV Metadata (optional) */}
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
              {'3. TSV Metadata (optional)'}
            </Typography>
          </Box>
          <Typography
            color={'text.secondary'}
            sx={{ display: 'block', mb: 2 }}
            variant={'caption'}
          >
            {'Sample attributes for filtering, selection, and merge summary review.'}
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
          {metadataTab === IMPORT_TAB.DROP && (
            <FileDropZone
              accept={'.tsv,.txt,.csv'}
              files={metadataFile}
              label={'TSV Metadata File'}
              onFilesSelected={onFileSelectedMetadata}
            />
          )}
          {metadataTab === IMPORT_TAB.URL && (
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
          {metadataTab === IMPORT_TAB.PASTE && (
            <Box sx={{ minHeight: 180 }}>
              <TextField
                fullWidth
                label={'Paste TSV Content'}
                multiline
                onChange={onChangeMetadataText}
                placeholder={'SampleID\tCountry\tDate\nSample1\tNL\t2024-01-01'}
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
  defaultTitle: 'Load record merger data',
  fullWidth: true,
  maxWidth: 'xl',
  testId: 'RecordMergerImportDialog',
});

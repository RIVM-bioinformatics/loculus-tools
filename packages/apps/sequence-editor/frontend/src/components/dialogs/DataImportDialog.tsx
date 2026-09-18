import type { ChangeEvent } from 'react';
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
  Divider,
  TextField,
  Typography,
} from '@mui/material';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import FileOpenOutlinedIcon from '@mui/icons-material/FileOpenOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import { FileDropZone } from '@gen-epix/ui-core-components/components/FileDropZone';

export interface DataImportDialogProps {
  dirty: boolean;
  error: null | string;
  onClose: () => void;
  onLoad: (fasta: string, label: string) => Promise<boolean>;
  open: boolean;
}

export const DataImportDialog = ({
  dirty,
  error,
  onClose,
  onLoad,
  open,
}: DataImportDialogProps) => {
  const [fastaFile, setFastaFile] = useState<FileList | null>(null);
  const [fastaText, setFastaText] = useState('');
  const [localError, setLocalError] = useState<null | string>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const reset = useCallback(() => {
    setFastaFile(null);
    setFastaText('');
    setLocalError(null);
    setConfirmReplace(false);
    setDemoLoading(false);
  }, []);

  const onCloseDialog = useCallback(() => {
    if (demoLoading) {
      return;
    }
    reset();
    onClose();
  }, [demoLoading, onClose, reset]);

  const onFilesSelected = useCallback((files: FileList) => {
    setFastaFile(files);
    setFastaText('');
    setLocalError(null);
  }, []);

  const loadContent = useCallback(async (content: string, label: string): Promise<boolean> => {
    if (dirty && !confirmReplace) {
      setConfirmReplace(true);
      return false;
    }

    setLocalError(null);
    setConfirmReplace(false);
    return onLoad(content, label);
  }, [confirmReplace, dirty, onLoad]);

  const onClickLoad = useCallback(async () => {
    setLocalError(null);
    let content = fastaText;
    let label = 'pasted-alignment.fasta';

    if (fastaFile?.[0]) {
      content = await fastaFile[0].text();
      label = fastaFile[0].name;
    }
    if (!content.trim()) {
      setLocalError('Choose a FASTA file or paste an alignment before loading.');
      return;
    }

    await loadContent(content, label);
  }, [fastaFile, fastaText, loadContent]);

  const onClickDemo = useCallback(async () => {
    if (dirty && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }

    setDemoLoading(true);
    setLocalError(null);
    try {
      const response = await fetch('/sample-data/sarscov2_demo.fasta');
      if (!response.ok) {
        throw new Error(`Demo alignment failed to load (${response.status}).`);
      }
      const loaded = await loadContent(await response.text(), 'sarscov2_demo.fasta');
      if (!loaded) {
        return;
      }
    } catch (caught: unknown) {
      setLocalError(caught instanceof Error ? caught.message : 'Demo alignment failed to load.');
    } finally {
      setDemoLoading(false);
    }
  }, [confirmReplace, dirty, loadContent]);

  const onChangeText = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFastaText(event.target.value);
    setFastaFile(null);
    setLocalError(null);
  }, []);

  const displayedError = localError ?? error;

  return (
    <Dialog
      fullWidth
      maxWidth={'md'}
      onClose={onCloseDialog}
      open={open}
    >
      <DialogTitle sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
        <BiotechOutlinedIcon color={'primary'} />
        {'Import FASTA'}
      </DialogTitle>
      <DialogContent dividers>
        {displayedError && (
          <Alert
            severity={'error'}
            sx={{ mb: 2 }}
          >
            {displayedError}
          </Alert>
        )}
        {confirmReplace && (
          <Alert
            severity={'warning'}
            sx={{ mb: 2 }}
          >
            {'The current dataset has unsaved changes. Choose Load again to replace it.'}
          </Alert>
        )}
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { md: '1fr 1fr', xs: '1fr' } }}>
          <Box>
            <Typography
              gutterBottom
              variant={'subtitle1'}
            >
              {'Choose a file'}
            </Typography>
            <FileDropZone
              accept={'.fasta,.fa,.fna,.aln'}
              files={fastaFile}
              helperText={'Drop a .fasta or .fa file here.'}
              onFilesSelected={onFilesSelected}
            />
          </Box>
          <Box>
            <Typography
              gutterBottom
              variant={'subtitle1'}
            >
              {'Paste FASTA'}
            </Typography>
            <TextField
              fullWidth
              minRows={8}
              multiline
              onChange={onChangeText}
              placeholder={'>record_1\nACGT...\n>record_2\nACGT...'}
              value={fastaText}
            />
          </Box>
        </Box>
        <Divider sx={{ my: 3 }} />
        <Button
          disabled={demoLoading}
          onClick={onClickDemo}
          startIcon={demoLoading ? (
            <CircularProgress
              color={'inherit'}
              size={18}
            />
          ) : <ScienceOutlinedIcon />}
          variant={'outlined'}
        >
          {'Load SARS-CoV-2 demo'}
        </Button>
        <Button
          component={'a'}
          href={'/sample-data/sarscov2_demo.fasta'}
          rel={'noreferrer'}
          startIcon={<FileOpenOutlinedIcon />}
          sx={{ ml: 1 }}
          target={'_blank'}
          variant={'text'}
        >
          {'View demo FASTA'}
        </Button>
      </DialogContent>
      <DialogActions>
        <Button
          disabled={demoLoading}
          onClick={onCloseDialog}
          variant={'text'}
        >
          {'Cancel'}
        </Button>
        <Button
          disabled={demoLoading}
          onClick={onClickLoad}
          startIcon={<FileOpenOutlinedIcon />}
          variant={'contained'}
        >
          {confirmReplace ? 'Replace dataset' : 'Load FASTA'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

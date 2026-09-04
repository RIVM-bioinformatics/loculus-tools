import { useCallback } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';

import { useDatasetStore } from '../../stores/datasetStore';

export const AlignmentErrorDialog = () => {
  const parsedFasta = useDatasetStore((state) => state.parsedFasta);
  const alignmentErrorDismissed = useDatasetStore((state) => state.alignmentErrorDismissed);
  const setAlignmentErrorDismissed = useDatasetStore((state) => state.setAlignmentErrorDismissed);

  const open = Boolean(parsedFasta && !parsedFasta.isAligned && !alignmentErrorDismissed);
  const onCloseDialog = useCallback(() => {
    setAlignmentErrorDismissed(true);
  }, [setAlignmentErrorDismissed]);

  if (!open || !parsedFasta) {
    return null;
  }

  return (
    <Dialog
      fullWidth
      maxWidth={'md'}
      onClose={onCloseDialog}
      open={open}
    >
      <DialogTitle sx={{ alignItems: 'center', color: 'error.main', display: 'flex', gap: 1 }}>
        <ErrorOutlineIcon color={'error'} />
        {'Pre-Alignment Validation Failed'}
      </DialogTitle>
      <DialogContent
        dividers
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Alert severity={'error'}>
          <AlertTitle>
            {'Tree calculation failed: Unaligned FASTA sequences'}
          </AlertTitle>
          {'The provided FASTA sequences are not aligned. Phylogenetic tree computation requires pre-aligned nucleotide or amino-acid sequences of identical character length.'}
        </Alert>
        <Typography
          color={'text.secondary'}
          variant={'body2'}
        >
          {'Expected alignment length based on first sequence: '}
          <strong>
            {parsedFasta.expectedLength}
            {' '}
            {'bp'}
          </strong>
        </Typography>
        {parsedFasta.invalidSequences && parsedFasta.invalidSequences.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography
              gutterBottom
              sx={{ fontWeight: 600 }}
              variant={'subtitle2'}
            >
              {'Sequences with mismatched length ('}
              {parsedFasta.invalidSequences.length}
              {'):'}
            </Typography>
            <TableContainer
              component={Paper}
              sx={{ maxHeight: 250 }}
              variant={'outlined'}
            >
              <Table
                size={'small'}
                stickyHeader
              >
                <TableHead>
                  <TableRow>
                    <TableCell>
                      {'Sequence Identifier'}
                    </TableCell>
                    <TableCell align={'right'}>
                      {'Observed Length (bp)'}
                    </TableCell>
                    <TableCell align={'right'}>
                      {'Difference (bp)'}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedFasta.invalidSequences.slice(0, 50).map((seq) => (
                    <TableRow key={seq.id}>
                      <TableCell sx={{ fontFamily: 'monospace' }}>
                        {seq.id}
                      </TableCell>
                      <TableCell
                        align={'right'}
                        sx={{ color: 'error.main', fontWeight: 600 }}
                      >
                        {seq.length}
                      </TableCell>
                      <TableCell align={'right'}>
                        {seq.length - parsedFasta.expectedLength > 0 ? `+${seq.length - parsedFasta.expectedLength}` : seq.length - parsedFasta.expectedLength}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ padding: 2 }}>
        <Button
          color={'primary'}
          onClick={onCloseDialog}
          variant={'contained'}
        >
          {'Dismiss & Review Input'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  AlertTitle,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { useDatasetStore } from '../../stores/datasetStore';

export const AlignmentErrorDialog: React.FC = () => {
  const parsedFasta = useDatasetStore((state) => state.parsedFasta);
  const alignmentErrorDismissed = useDatasetStore((state) => state.alignmentErrorDismissed);
  const setAlignmentErrorDismissed = useDatasetStore((state) => state.setAlignmentErrorDismissed);

  const open = Boolean(parsedFasta && !parsedFasta.isAligned && !alignmentErrorDismissed);

  if (!open || !parsedFasta) return null;

  return (
    <Dialog open={open} maxWidth="md" fullWidth onClose={() => setAlignmentErrorDismissed(true)}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
        <ErrorOutlineIcon color="error" />
        Pre-Alignment Validation Failed
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Alert severity="error">
          <AlertTitle>Tree calculation failed: Unaligned FASTA sequences</AlertTitle>
          The provided FASTA sequences are not aligned. Phylogenetic tree computation requires pre-aligned nucleotide or amino-acid sequences of identical character length.
        </Alert>

        <Typography variant="body2" color="text.secondary">
          Expected alignment length based on first sequence: <strong>{parsedFasta.expectedLength} bp</strong>
        </Typography>

        {parsedFasta.invalidSequences && parsedFasta.invalidSequences.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              Sequences with mismatched length ({parsedFasta.invalidSequences.length}):
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 250 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Sequence Identifier</TableCell>
                    <TableCell align="right">Observed Length (bp)</TableCell>
                    <TableCell align="right">Difference (bp)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedFasta.invalidSequences.slice(0, 50).map((seq) => (
                    <TableRow key={seq.id}>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{seq.id}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: 'error.main' }}>
                        {seq.length}
                      </TableCell>
                      <TableCell align="right">
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
        <Button onClick={() => setAlignmentErrorDismissed(true)} variant="contained" color="primary">
          Dismiss & Review Input
        </Button>
      </DialogActions>
    </Dialog>
  );
};

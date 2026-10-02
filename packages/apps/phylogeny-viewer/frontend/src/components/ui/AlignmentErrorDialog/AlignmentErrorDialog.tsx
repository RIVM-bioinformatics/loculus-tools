import {
  Alert,
  AlertTitle,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type {
  WithDialogRefMethods,
  WithDialogRenderProps,
} from '@gen-epix/ui-core-components/hoc/withDialog';
import { withDialog } from '@gen-epix/ui-core-components/hoc/withDialog';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { useStore } from 'zustand';

import { phylogenyViewerStore } from '../../../stores/phylogenyViewerStore';

export interface AlignmentErrorDialogOpenProps {
  //
}

export interface AlignmentErrorDialogProps extends WithDialogRenderProps<AlignmentErrorDialogOpenProps> {
  //
}

export type AlignmentErrorDialogRefMethods = WithDialogRefMethods<AlignmentErrorDialogProps, AlignmentErrorDialogOpenProps>;

export const AlignmentErrorDialog = withDialog<AlignmentErrorDialogProps, AlignmentErrorDialogOpenProps>((
  {
    onActionsChange,
    onClose,
  }: AlignmentErrorDialogProps,
): ReactElement => {
  const parsedFasta = useStore(phylogenyViewerStore, (state) => state.parsedFasta);

  useEffect(() => {
    const actions: DialogAction[] = [];
    actions.push(
      {
        autoFocus: true,
        color: 'secondary',
        label: 'Close',
        onClick: onClose,
        variant: 'contained',
      },
    );
    onActionsChange(actions);
  }, [onActionsChange, onClose]);

  return (
    <>
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
    </>
  );

}, {
  defaultTitle: 'Pre-Alignment Validation Failed',
  fullWidth: true,
  maxWidth: 'xl',
  testId: 'AlignmentErrorDialog',
});

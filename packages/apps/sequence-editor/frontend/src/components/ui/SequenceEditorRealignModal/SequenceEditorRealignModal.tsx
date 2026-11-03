import {
  Box,
  CircularProgress,
  Typography,
} from '@mui/material';
import type {
  WithDialogRefMethods,
  WithDialogRenderProps,
} from '@gen-epix/ui-core-components/hoc/withDialog';
import { withDialog } from '@gen-epix/ui-core-components/hoc/withDialog';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import type { ReactElement } from 'react';
import {
  useCallback,
  useEffect,
} from 'react';
import { container } from 'tsyringe';

import { SequenceEditorEventBusService } from '../../../classes/services/SequenceEditorEventBusService';

export interface SequenceEditorRealignModalOpenProps {
  //
}

export interface SequenceEditorRealignModalProps extends WithDialogRenderProps<SequenceEditorRealignModalOpenProps> {
  //
}

export type SequenceEditorRealignModalRefMethods = WithDialogRefMethods<SequenceEditorRealignModalProps, SequenceEditorRealignModalOpenProps>;

export const SequenceEditorRealignModal = withDialog<SequenceEditorRealignModalProps, SequenceEditorRealignModalOpenProps>((
  {
    onActionsChange,
  }: SequenceEditorRealignModalProps,
): ReactElement => {
  const onCancelClick = useCallback(() => {
    container.resolve(SequenceEditorEventBusService).emit('onCancelRealign');
  }, []);

  useEffect(() => {
    const actions: DialogAction[] = [
      {
        color: 'primary',
        label: 'Cancel',
        onClick: onCancelClick,
        variant: 'outlined',
      },
    ];
    onActionsChange?.(actions);
  }, [onActionsChange, onCancelClick]);

  return (
    <Box
      sx={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        maxWidth: 480,
        p: 3,
        textAlign: 'center',
      }}
    >
      <CircularProgress
        color={'primary'}
        size={36}
      />
      <Typography
        color={'text.secondary'}
        variant={'body2'}
      >
        {'Sequence (re-)alignment in progress using MAFFT (progressive alignment with FFT-NS-1). This may take a while depending on the amount of sequences.'}
      </Typography>
    </Box>
  );

}, {
  defaultTitle: 'Sequence Re-alignment',
  disableBackdropClick: true,
  fullWidth: true,
  maxWidth: 'sm',
  noCloseButton: true,
  noPadding: true,
  testId: 'SequenceEditorRealignModal',
});

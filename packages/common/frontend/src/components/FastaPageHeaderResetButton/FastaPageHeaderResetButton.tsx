import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  useCallback,
  useRef,
} from 'react';
import { Confirmation } from '@gen-epix/ui-core-components/components/Confirmation';
import type { ConfirmationRefMethods } from '@gen-epix/ui-core-components/components/Confirmation';
import { t } from 'i18next';

export type FastaPageHeaderResetButtonProps = {
  onReset: () => void;
};

export const FastaPageHeaderResetButton = ({ onReset }: FastaPageHeaderResetButtonProps) => {
  const confirmationRef = useRef<ConfirmationRefMethods>(null);
  const onClickResetSession = useCallback(() => {
    confirmationRef.current?.open();
  }, []);

  const onConfirm = useCallback(() => {
    onReset();
  }, [onReset]);

  return (
    <>
      <Tooltip title={'Reset current session and dataset'}>
        <IconButton
          color={'inherit'}
          onClick={onClickResetSession}
          size={'small'}
          sx={{ opacity: 0.85 }}
        >
          <RestartAltIcon fontSize={'small'} />
        </IconButton>
      </Tooltip>
      <Confirmation
        body={t`Are you sure you want to reset the current session and dataset?`}
        cancelLabel={t`Cancel`}
        confirmLabel={t`Reset`}
        onConfirm={onConfirm}
        ref={confirmationRef}
        title={t`Reset current session and dataset?`}
      />
    </>
  );
};

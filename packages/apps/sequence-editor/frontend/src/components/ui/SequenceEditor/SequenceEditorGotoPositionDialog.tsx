import { TextField } from '@mui/material';
import type {
  WithDialogRefMethods,
  WithDialogRenderProps,
} from '@gen-epix/ui-core-components/hoc/withDialog';
import { withDialog } from '@gen-epix/ui-core-components/hoc/withDialog';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import type {
  ChangeEvent,
  KeyboardEvent,
  ReactElement,
} from 'react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

const GOTO_POSITION_REGEX = /^(?:\d+|,\d+|\d+,\d+)$/;

export interface SequenceEditorGotoPositionDialogOpenProps {
  //
}

export interface SequenceEditorGotoPositionDialogProps extends WithDialogRenderProps<SequenceEditorGotoPositionDialogOpenProps> {
  onGotoPosition: (x: null | number, y: null | number) => void;
}

export type SequenceEditorGotoPositionDialogRefMethods = WithDialogRefMethods<SequenceEditorGotoPositionDialogProps, SequenceEditorGotoPositionDialogOpenProps>;

export const SequenceEditorGotoPositionDialog = withDialog<SequenceEditorGotoPositionDialogProps, SequenceEditorGotoPositionDialogOpenProps>((
  {
    onActionsChange,
    onClose,
    onGotoPosition,
  }: SequenceEditorGotoPositionDialogProps,
): ReactElement => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isValid = value === '' || GOTO_POSITION_REGEX.test(value);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  }, []);

  const onSubmit = useCallback(() => {
    if (!isValid) {
      return;
    }
    const [x, y] = value.split(',');
    onGotoPosition(x ? Number(x) : null, y ? Number(y) : null);
    onClose?.();
  }, [isValid, onClose, onGotoPosition, value]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSubmit();
    }
  }, [onSubmit]);

  useEffect(() => {
    const actions: DialogAction[] = [];
    actions.push(
      {
        color: 'secondary',
        label: 'Close',
        onClick: onClose,
        variant: 'outlined',
      },
    );
    actions.push(
      {
        color: 'primary',
        disabled: !isValid,
        label: 'Ok',
        onClick: onSubmit,
        variant: 'contained',
      },
    );
    onActionsChange?.(actions);
  }, [isValid, onActionsChange, onClose, onSubmit]);

  return (
    <TextField
      error={!isValid}
      fullWidth
      helperText={'Use x, ,y, or x,y.'}
      inputRef={inputRef}
      label={'Position'}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={'x or ,y or x,y'}
      value={value}
    />
  );

}, {
  defaultTitle: 'Goto position (x) or (,y) or (x,y)',
  fullWidth: true,
  maxWidth: 'xs',
  testId: 'SequenceEditorGotoPositionDialog',
});

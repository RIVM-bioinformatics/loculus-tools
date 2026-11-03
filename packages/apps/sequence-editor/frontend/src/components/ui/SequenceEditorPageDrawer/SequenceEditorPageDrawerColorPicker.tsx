import { useCallback } from 'react';
import { MuiColorInput } from 'mui-color-input';

import type { PaletteEntry } from '../../../models/palette.models';

type SequenceEditorPageDrawerColorPickerProps<TSymbol extends string> = {
  field: keyof PaletteEntry;
  label: string;
  onColorChange: (symbol: TSymbol, field: keyof PaletteEntry, color: string) => void;
  symbol: TSymbol;
  value: string;
};

export const SequenceEditorPageDrawerColorPicker = <TSymbol extends string, >({
  field,
  label,
  onColorChange,
  symbol,
  value,
}: SequenceEditorPageDrawerColorPickerProps<TSymbol>) => {
  const onChange = useCallback((color: string) => {
    onColorChange(symbol, field, color);
  }, [field, onColorChange, symbol]);

  return (
    <MuiColorInput
      format={'hex'}
      isAlphaHidden
      label={label}
      onChange={onChange}
      size={'small'}
      value={value}
    />
  );
};

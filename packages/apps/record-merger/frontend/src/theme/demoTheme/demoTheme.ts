import { createDemoThemeOptions } from '@rivm-loculus-tools/common-frontend/theme/demoTheme';
import type {
  PaletteMode,
  Theme,
  ThemeOptions,
} from '@mui/material';
import { createTheme as muiCreateTheme } from '@mui/material';

export const createRecordMergerThemeOptions = (paletteMode: PaletteMode): ThemeOptions => {
  return createDemoThemeOptions(paletteMode);
};

export const createRecordMergerTheme = (paletteMode: PaletteMode): Theme => {
  return muiCreateTheme(createRecordMergerThemeOptions(paletteMode));
};

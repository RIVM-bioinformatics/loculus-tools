import { createDemoThemeOptions } from '@rivm-loculus-tools/common-frontend/theme/demoTheme';
import type {
  PaletteMode,
  Theme,
  ThemeOptions,
} from '@mui/material';
import { createTheme as muiCreateTheme } from '@mui/material';

export const createSequenceEditorThemeOptions = (paletteMode: PaletteMode): ThemeOptions => {
  const commonThemeOptions = createDemoThemeOptions(paletteMode);
  const themeOptions: ThemeOptions = {
    ...commonThemeOptions,
    components: {
      ...commonThemeOptions.components,
    },
  };
  return themeOptions;
};

export const createSequenceEditorTheme = (paletteMode: PaletteMode): Theme => {
  return muiCreateTheme(createSequenceEditorThemeOptions(paletteMode));
};

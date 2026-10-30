import { createDemoThemeOptions } from '@rivm-loculus-tools/common-frontend/theme/demoTheme';
import type {
  PaletteMode,
  Theme,
  ThemeOptions,
} from '@mui/material';
import {
  lighten,
  createTheme as muiCreateTheme,
} from '@mui/material';

export const createPhylogenyViewerThemeOptions = (paletteMode: PaletteMode): ThemeOptions => {
  const commonThemeOptions = createDemoThemeOptions(paletteMode);
  const themeOptions: ThemeOptions = {
    ...commonThemeOptions,
    components: {
      ...commonThemeOptions.components,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      GenEpixUiPhylogeneticTree: {
        backgroundColor: '#fff',
        defaultProps: {
          dimFn: (color: string) => lighten(color, 0.8),
        },
        labelFont: '0.7rem "Roboto Flex"',
        regularFillColorSupportLine: '#E0E6F1',
        scaleColor: '#334155',
        scaleFont: 'bold 0.7rem "Roboto Flex"',
        supportLineColorLinked: '#0f0',
        supportLineColorUnlinked: '#f00',
        treeColor: '#334155',
      },
    },
  };
  return themeOptions;
};

export const createPhylogenyViewerTheme = (paletteMode: PaletteMode): Theme => {
  return muiCreateTheme(createPhylogenyViewerThemeOptions(paletteMode));
};

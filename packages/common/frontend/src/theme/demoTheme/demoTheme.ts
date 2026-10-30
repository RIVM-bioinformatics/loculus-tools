/* eslint-disable @typescript-eslint/naming-convention */
import type {
  PaletteMode,
  Theme,
  ThemeOptions,
} from '@mui/material';
import { createTheme } from '@mui/material';

import robotoFlexWoff2 from './fonts/RobotoFlex.woff2';

export const createDemoThemeOptions = (paletteMode: PaletteMode): ThemeOptions => {
  const FONT_SIZE = 16;

  const MuiCssBaselineStyleOverrides = `
    /**
    *:focus-visible, .Mui-focusVisible {
      outline: 2px dotted #000 !important;
      outline-offset: 0 !important;
      box-shadow: 0 0 0 2px #fff !important;
    }
      **/

    html, body {
      font-size: ${FONT_SIZE}px;
      height: 100%;
      overscroll-behavior: none;
    }
    #root {
      height: 100%;
    }

    /* cyrillic-ext */
    @font-face {
      font-family: 'Roboto Flex';
      font-style: normal;
      font-weight: 100 1000;
      font-stretch: 100%;
      font-display: swap;
      src: url(${robotoFlexWoff2}) format('woff2');
      unicode-range: U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
    }
    /* cyrillic */
    @font-face {
      font-family: 'Roboto Flex';
      font-style: normal;
      font-weight: 100 1000;
      font-stretch: 100%;
      font-display: swap;
      src: url(${robotoFlexWoff2}) format('woff2');
      unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
    }
    /* greek */
    @font-face {
      font-family: 'Roboto Flex';
      font-style: normal;
      font-weight: 100 1000;
      font-stretch: 100%;
      font-display: swap;
      src: url(${robotoFlexWoff2}) format('woff2');
      unicode-range: U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF;
    }
    /* vietnamese */
    @font-face {
      font-family: 'Roboto Flex';
      font-style: normal;
      font-weight: 100 1000;
      font-stretch: 100%;
      font-display: swap;
      src: url(${robotoFlexWoff2}) format('woff2');
      unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
    }
    /* latin-ext */
    @font-face {
      font-family: 'Roboto Flex';
      font-style: normal;
      font-weight: 100 1000;
      font-stretch: 100%;
      font-display: swap;
      src: url(${robotoFlexWoff2}) format('woff2');
      unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
    }
    /* latin */
    @font-face {
      font-family: 'Roboto Flex';
      font-style: normal;
      font-weight: 100 1000;
      font-stretch: 100%;
      font-display: swap;
      src: url(${robotoFlexWoff2}) format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
  `;

  const themeOptions: ThemeOptions = {
    ...(import.meta.env.MODE === 'test' && { transitions: { create: () => 'none' } }),
    breakpoints: {
      values: {
        lg: 1340,
        md: 1024,
        sm: 640,
        xl: 1920,
        xs: 0,
      },
    },
    components: {
      MuiAlertTitle: {
        styleOverrides: {
          root: {
            color: 'inherit',
            fontWeight: 'bold',
            marginBottom: 0,
          },
        },
      },
      MuiButton: {
        defaultProps: {
          color: 'primary',
          variant: 'contained',
        },
        styleOverrides: {
          root: {
            fontWeight: 'bold',
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: MuiCssBaselineStyleOverrides,
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            backgroundColor: '#323946',
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            fontWeight: 'bold',
          },
        },
      },
      MuiFilledInput: {
        styleOverrides: {
          input: {
            color: '#323946',
          },
          root: {
            '&:hover': {
              backgroundColor: 'rgba(186,214,237,0.6)',
            },
            '&.Mui-disabled': {
              backgroundColor: 'rgba(186,214,237,0.1)',
            },
            '&.Mui-error': {
              '&:after': {
                borderBottomColor: '#a45c4f',
              },
              '&:hover': {
                backgroundColor: 'rgba(240,180,186,0.6)',
              },
              '&.Mui-disabled': {
                backgroundColor: 'rgba(240,180,186,0.1)',
              },
              '&.Mui-focused': {
                backgroundColor: 'rgba(240,180,186,0.6)',
              },
              backgroundColor: 'rgba(240,180,186,0.4)',
            },
            '&.Mui-focused': {
              backgroundColor: 'rgba(186,214,237,0.3)',
            },
            '&.Mui-warning': {
              '&:after': {
                borderBottomColor: 'rgb(119,80,21)',
                transform: 'scaleX(1)',
              },
              '&:hover': {
                '@media (hover: none)': {
                  backgroundColor: 'rgb(248,214,140,0.3)',
                },
                backgroundColor: 'rgb(248,214,140,0.6)',
              },
              '&.Mui-disabled': {
                backgroundColor: 'rgb(248,214,140,0.1)',
              },
              '&.Mui-focused': {
                backgroundColor: 'rgb(248,214,140,0.3)',
              },
              backgroundColor: 'rgb(248,214,140,0.3)',
            },
            backgroundColor: 'rgba(186,214,237,0.2)',
          },
        },
      },
      MuiFormControlLabel: {
        styleOverrides: {
          label: {
            color: '#323946',
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            '&.Mui-error': {
              color: '#ba2818',
            },
            '&.Mui-warning': {
              color: 'rgb(119,80,21)',
            },
            color: '#323946',
          },
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          asterisk: {
            color: '#D90000',
          },
          root: {
            '&.Mui-error': {
              color: '#ba2818',
            },
            '&.Mui-warning': {
              color: 'rgb(119,80,21)',
            },
            color: '#323946',
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            '&.Mui-error': {
              color: '#a45c4f',
            },
            '&.Mui-warning': {
              color: 'rgb(119,80,21)',
            },
            color: '#323946',
          },
        },
      },
      MuiLink: {
        styleOverrides: {
          root: {
            '&:hover': {
              textDecoration: 'underline',
            },
            textDecoration: 'underline',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '& input': {
              padding: '7.5px 4px 7.5px 5px',
            },
            padding: '9px',
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          select: {
            padding: '7.5px 32px 7.5px 5px',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: '#323946',
          },
        },
      },
      MuiTooltip: {
        defaultProps: {
          enterDelay: 500,
          enterNextDelay: 500,
        },
      },
      MuiTypography: {
        styleOverrides: {
          body1: {
            color: 'rgba(0,0,0,0.87)',
            fontSize: '1rem', // 14
          },
          body2: {
            color: 'rgba(0,0,0,0.87)',
            fontSize: '1rem', // 14
          },
          caption: {
            fontStyle: 'italic',
          },
          h1: {
            color: '#323946',
            fontSize: '2.143rem', // 30
            fontWeight: 700,
          },
          h2: {
            color: '#323946',
            fontSize: '1.857rem', // 26
            fontWeight: 400,
          },
          h3: {
            color: '#323946',
            fontSize: '1.714rem', // 24
            fontWeight: 700,
          },
          h4: {
            color: '#323946',
            fontSize: '1.429rem', // 20
            fontWeight: 700,
          },
          h5: {
            color: '#323946',
            fontSize: '1.286rem', // 16
            fontWeight: 700,
          },
          h6: {
            color: '#323946',
            fontSize: '1.143rem', // 16
            fontWeight: 400,
          },
          subtitle1: {
            color: 'rgba(0,0,0,0.87)',
            fontSize: '1.286rem', // 18
            fontWeight: 400,
          },
          subtitle2: {
            color: '#323946',
            fontSize: '1.143rem', // 16
            fontWeight: 700,
          },
        },
      },
      RivmLoculusToolsCommonFrontendButtonWithMenu: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
            },
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            color: '#FFFFFF',
          },
        },
      },
      RivmLoculusToolsCommonFrontendFastaPageHeaderCenterComponent: {
        styleOverrides: {
          root: {
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: '#FFFFFF',
            fontSize: '0.75rem',
            fontWeight: 600,
          },
        },
      },
      RivmLoculusToolsCommonFrontendFastaPageHeaderImportButton: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
            },
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            color: '#FFFFFF',
          },
        },
      },
      RivmLoculusToolsCommonFrontendPageCommonHeader: {
        backgroundColor: '#5160ab',
        color: '#fff',
      },
      RivmLoculusToolsCommonFrontendSearchBar: {
        buttonColor: '#5160ab',
        styleOverrides: {
          root: {
            backgroundColor: paletteMode === 'light' ? '#fff' : '#121212',
          },
        },
      },
      RivmLoculusToolsCommonFrontendSearchBarNodeCounter: {},
    },
    palette: {
      divider: '#eeeeee',
      error: {
        contrastText: '#fff',
        main: '#cf0101',
      },
      grey: {
        100: '#eeeeee',
        500: '#777777',
      },
      mode: paletteMode,
      primary: {
        contrastText: '#fff',
        main: '#5160ab',
      },
      secondary: {
        contrastText: '#323946',
        main: '#f8f9fa',
      },
      success: {
        contrastText: '#fff',
        main: '#05B803',
      },
    },
    spacing: 8,
    typography: {
      button: {
        fontWeight: 600,
        textTransform: 'none',
      },
      fontFamily: 'Roboto Flex',
      fontSize: FONT_SIZE,
      htmlFontSize: FONT_SIZE,
    },
  };

  return themeOptions;
};

export const createDemoTheme = (paletteMode: PaletteMode): Theme => {
  return createTheme(createDemoThemeOptions(paletteMode));
};

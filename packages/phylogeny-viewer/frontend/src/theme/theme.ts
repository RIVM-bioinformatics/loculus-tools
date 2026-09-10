/* eslint-disable @typescript-eslint/naming-convention */
import { createTheme } from '@mui/material';

const MuiCssBaselineStyleOverrides = `
    /**
    *:focus-visible, .Mui-focusVisible {
      outline: 2px dotted #000 !important;
      outline-offset: 0 !important;
      box-shadow: 0 0 0 2px #fff !important;
    }
      **/
  `;

export const theme = createTheme({
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
          backgroundColor: '#c9defc',
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
          color: '#282245',
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
          color: '#282245',
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
          color: '#453e6d',
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
          color: '#453e6d',
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
          color: '#453e6d',
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
          borderColor: '#c9defc',
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
          color: '#171c42',
          fontSize: '2.143rem', // 30
          fontWeight: 700,
        },
        h2: {
          color: '#171c42',
          fontSize: '1.857rem', // 26
          fontWeight: 400,
        },
        h3: {
          color: '#171c42',
          fontSize: '1.714rem', // 24
          fontWeight: 700,
        },
        h4: {
          color: '#171c42',
          fontSize: '1.429rem', // 20
          fontWeight: 700,
        },
        h5: {
          color: '#171c42',
          fontSize: '1.286rem', // 16
          fontWeight: 700,
        },
        h6: {
          color: '#171c42',
          fontSize: '1.143rem', // 16
          fontWeight: 400,
        },
        subtitle1: {
          color: 'rgba(0,0,0,0.87)',
          fontSize: '1.286rem', // 18
          fontWeight: 400,
        },
        subtitle2: {
          color: '#171c42',
          fontSize: '1.143rem', // 16
          fontWeight: 700,
        },
      },
    },
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
    mode: 'light',
    primary: {
      contrastText: '#fff',
      main: '#154273',
    },
    secondary: {
      contrastText: '#fff',
      main: '#2a2b33',
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
    fontFamily: '"Noto Sans", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
});

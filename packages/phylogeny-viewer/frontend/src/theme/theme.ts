import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  components: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    MuiButton: {
      styleOverrides: {
        root: {
          '&:hover': {
            boxShadow: 'none',
          },
          borderRadius: 6,
          boxShadow: 'none',
        },
      },
    },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
  palette: {
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    divider: '#E2E8F0',
    mode: 'light',
    primary: {
      contrastText: '#FFFFFF',
      dark: '#004C72',
      light: '#3386AF',
      main: '#01689B', // Official RIVM Blue
    },
    secondary: {
      dark: '#166534',
      light: '#22C55E',
      main: '#15803D',
    },
    text: {
      primary: '#0F172A',
      secondary: '#475569',
    },
  },
  typography: {
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
    fontFamily: '"Noto Sans", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
});

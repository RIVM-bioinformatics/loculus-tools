import { createTheme, lighten } from '@mui/material/styles';

export const phyloTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#01689B', // Official RIVM Blue
      light: '#3386AF',
      dark: '#004C72',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#15803D',
      light: '#22C55E',
      dark: '#166534',
    },
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0F172A',
      secondary: '#475569',
    },
    divider: '#E2E8F0',
  },
  typography: {
    fontFamily: '"Noto Sans", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
  // Extension required by TreeUtil in @gen-epix/ui-casedb
  'gen-epix-ui-casedb': {
    lineList: {
      font: '0.8rem "Noto Sans Mono", monospace',
    },
    tree: {
      color: '#1E293B',
      dimFn: (color: string) => lighten(color, 0.75),
      font: 'bold 0.75rem "Noto Sans Mono", monospace',
      supportLineColorLinked: '#334155',
      supportLineColorUnlinked: '#CBD5E1',
    },
  } as any,
} as any);

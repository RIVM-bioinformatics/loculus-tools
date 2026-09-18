import { createRoot } from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@rivm-loculus-tools/frontend-common/theme';
import { StrictMode } from 'react';

import { TestHarness } from './TestHarness';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <TestHarness />
    </ThemeProvider>
  </StrictMode>,
);

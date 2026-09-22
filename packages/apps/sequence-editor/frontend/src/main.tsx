import { createRoot } from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import { StrictMode } from 'react';

import { TestHarness } from './components/TestHarness';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CssBaseline />
    <TestHarness />
  </StrictMode>,
);

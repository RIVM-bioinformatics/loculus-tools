import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { I18nextProvider } from 'react-i18next';
import { ErrorBoundary } from 'react-error-boundary';
import { theme } from '@rivm-loculus-tools/frontend-common/theme';

import { editorI18n } from '../../i18n';
import { MainPage } from '../pages/MainPage';

import { ErrorFallback } from './ErrorFallback';

export const App = () => (
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <I18nextProvider i18n={editorI18n}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <MainPage />
      </ThemeProvider>
    </I18nextProvider>
  </ErrorBoundary>
);

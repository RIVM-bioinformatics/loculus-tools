import {
  CssBaseline,
  ThemeProvider,
} from '@mui/material';
import { theme } from '@rivm-loculus-tools/frontend-common/theme';
import { ErrorBoundary } from 'react-error-boundary';

import { I18nWrapper } from '../../ui/I18nWrapper';
import { ErrorPage } from '../../pages/ErrorPage';
import { MainPage } from '../../pages/MainPage';

export const App = () => {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorPage}
    >
      <I18nWrapper>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <MainPage />
        </ThemeProvider>
      </I18nWrapper>
    </ErrorBoundary>
  );
};

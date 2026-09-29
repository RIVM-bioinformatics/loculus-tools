import {
  CssBaseline,
  ThemeProvider,
} from '@mui/material';
import { theme } from '@rivm-loculus-tools/frontend-common/theme';
import { ErrorBoundary } from 'react-error-boundary';
import { I18nWrapper } from '@rivm-loculus-tools/frontend-common/components/I18nWrapper';
import { PageCommonContextProvider } from '@rivm-loculus-tools/frontend-common/components/page';

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
          <PageCommonContextProvider>
            <MainPage />
          </PageCommonContextProvider>
        </ThemeProvider>
      </I18nWrapper>
    </ErrorBoundary>
  );
};

import {
  CssBaseline,
  ThemeProvider,
} from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

import { theme } from '../../theme/theme';
import { I18nWrapper } from '../common/I18nWrapper';
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

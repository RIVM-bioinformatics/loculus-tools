import {
  CssBaseline,
  ThemeProvider,
} from '@mui/material';
import { theme } from '@rivm-loculus-tools/frontend-common/theme';
import { ErrorBoundary } from 'react-error-boundary';
import { I18nWrapper } from '@rivm-loculus-tools/frontend-common/components/I18nWrapper';
import { PageCommonContextProvider } from '@rivm-loculus-tools/frontend-common/components/page';

import { PhylogenyViewerErrorPage } from '../../pages/PhylogenyViewerErrorPage';
import { PhylogenyViewerPageMainPage } from '../../pages/PhylogenyViewerPageMainPage';

export const App = () => {
  return (
    <ErrorBoundary
      FallbackComponent={PhylogenyViewerErrorPage}
    >
      <I18nWrapper>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <PageCommonContextProvider>
            <PhylogenyViewerPageMainPage />
          </PageCommonContextProvider>
        </ThemeProvider>
      </I18nWrapper>
    </ErrorBoundary>
  );
};

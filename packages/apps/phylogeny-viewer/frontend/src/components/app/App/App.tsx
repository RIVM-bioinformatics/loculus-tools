import {
  CssBaseline,
  ThemeProvider,
} from '@mui/material';
import { theme } from '@rivm-loculus-tools/frontend-common/theme';
import { ErrorBoundary } from 'react-error-boundary';
import { I18nWrapper } from '@rivm-loculus-tools/frontend-common/components/I18nWrapper';
import { PageCommonContextProvider } from '@rivm-loculus-tools/frontend-common/components/page';

import { PhyloViewerErrorPage } from '../../pages/PhyloViewerErrorPage';
import { PhyloViewerPageMainPage } from '../../pages/PhyloViewerPageMainPage';

export const App = () => {
  return (
    <ErrorBoundary
      FallbackComponent={PhyloViewerErrorPage}
    >
      <I18nWrapper>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <PageCommonContextProvider>
            <PhyloViewerPageMainPage />
          </PageCommonContextProvider>
        </ThemeProvider>
      </I18nWrapper>
    </ErrorBoundary>
  );
};

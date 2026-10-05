import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { ErrorBoundary } from 'react-error-boundary';
import { theme } from '@rivm-loculus-tools/frontend-common/theme';
import { I18nWrapper } from '@rivm-loculus-tools/frontend-common/components/I18nWrapper';
import { PageCommonContextProvider } from '@rivm-loculus-tools/frontend-common/components/page';

import { SeqenceEditorMainPage } from '../../pages/SeqenceEditorMainPage';
import { SeqenceEditorErrorPage } from '../../pages/SeqenceEditorErrorPage';

export const App = () => (
  <ErrorBoundary FallbackComponent={SeqenceEditorErrorPage}>
    <I18nWrapper>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <PageCommonContextProvider>
          <SeqenceEditorMainPage />
        </PageCommonContextProvider>
      </ThemeProvider>
    </I18nWrapper>
  </ErrorBoundary>
);

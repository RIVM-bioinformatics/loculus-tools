import { container } from 'tsyringe';
import { CacheProvider } from '@emotion/react';
import { setupUiCore } from '@gen-epix/ui-core/setup/setup';
import {
  CssBaseline,
  ThemeProvider,
} from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import type { PropsWithChildren } from 'react';

import { EmotionCacheService } from '../../../classes/services/EmotionCacheService';
import type { ConfigBase } from '../../../models/config.models';
import { DependencyContainerUtil } from '../../../utils/DependencyContainerUtil';
import { ErrorPage } from '../../../pages/ErrorPage';
import { I18nWrapper } from '../../ui/I18nWrapper';
import { PageCommonContextProvider } from '../../../context/pageCommonContext';
import { AuthenticationLoader } from '../../authentication/AuthenticationLoader';

export type AppProps = PropsWithChildren<{
  useAuthentication?: boolean;
}>;

export const App = ({ children, useAuthentication }: AppProps) => {
  setupUiCore();
  const config = DependencyContainerUtil.resolveConfig<ConfigBase>();
  const { pageConfig } = config;
  const touchIconUrl = config.getTouchIconUrl?.();
  if (touchIconUrl) {
    document.querySelector('link[rel="icon"]')?.setAttribute('href', touchIconUrl);
  }

  const emotionCache = container.resolve(EmotionCacheService).emotionCache;

  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={config.theme}>
        <CssBaseline />
        <ErrorBoundary FallbackComponent={ErrorPage}>
          <I18nWrapper>
            <PageCommonContextProvider {...pageConfig}>
              {useAuthentication ? (
                <AuthenticationLoader>
                  {children}
                </AuthenticationLoader>
              ) : (
                children
              )}
            </PageCommonContextProvider>
          </I18nWrapper>
        </ErrorBoundary>
      </ThemeProvider>
    </CacheProvider>
  );
};

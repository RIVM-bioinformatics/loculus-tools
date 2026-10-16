import type { DependencyContainer } from 'tsyringe';
import { CacheProvider } from '@emotion/react';
import {
  CssBaseline,
  ThemeProvider,
} from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import type { PropsWithChildren } from 'react';

import { EmotionCacheService } from '../../../classes/services/EmotionCacheService';
import type { ConfigBase } from '../../../models/config.models';
import { DependencyContainerUtil } from '../../../utils/DependencyContainerUtil';
import { CommonConfigContextProvider } from '../../../context/commonConfigContext';
import { ErrorPage } from '../../../pages/ErrorPage';
import { I18nWrapper } from '../../ui/I18nWrapper';

export type AppProps = PropsWithChildren<{
  readonly container: DependencyContainer;
}>;

export const App = ({ children, container }: AppProps) => {
  const config = DependencyContainerUtil.resolveConfig<ConfigBase>(container);

  const touchIconUrl = config.getTouchIconUrl();
  if (touchIconUrl) {
    document.querySelector('link[rel="icon"]')?.setAttribute('href', touchIconUrl);
  }

  const emotionCache = container.resolve(EmotionCacheService).emotionCache;

  return (
    <CommonConfigContextProvider container={container}>
      <CacheProvider value={emotionCache}>
        <ThemeProvider theme={config.theme}>
          <CssBaseline />
          <ErrorBoundary FallbackComponent={ErrorPage}>
            <I18nWrapper>
              {children}
            </I18nWrapper>
          </ErrorBoundary>
        </ThemeProvider>
      </CacheProvider>
    </CommonConfigContextProvider>
  );
};

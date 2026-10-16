import type { DependencyContainer } from 'tsyringe';
import { container as rootContainer } from 'tsyringe';
import { CacheProvider } from '@emotion/react';
import {
  CssBaseline,
  ThemeProvider,
} from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

import { API_BASE_TOKEN } from '../../../constants/api.constants';
import { BackendVersionService } from '../../../classes/services/BackendVersionService';
import { QueryClientService } from '../../../classes/services/QueryClientService';
import { ErrorPage } from '../../../pages/ErrorPage';
import { EmotionCacheService } from '../../../classes/services/EmotionCacheService';
import { AuthenticationService } from '../../../classes/services/AuthenticationService';
import { LogService } from '../../../classes/services/LogService';
import { ApplicationBootstrapWithoutAuthorization } from '../ApplicationBootstrapWithoutAuthorization';
import { AppRouterProvider } from '../AppRouterProvider/AppRouterProvider';
import { ClientCommonConfigContextProvider } from '../../../context/ClientCommonConfigContext';
import type { ConfigBase } from '../../../models/config.models';
import { DependencyContainerUtil } from '../../../utils/DependencyContainerUtil';

export type AppProps = {
  readonly container: DependencyContainer;
};

export const App = ({ container }: AppProps) => {
  const config = DependencyContainerUtil.resolveConfig<ConfigBase>(container);

  const authenticationService = rootContainer.resolve(AuthenticationService);
  const logService = rootContainer.resolve(LogService);
  const touchIconUrl = config.getTouchIconUrl();
  if (touchIconUrl) {
    document.querySelector('link[rel="icon"]')?.setAttribute('href', touchIconUrl);
  }
  const api = rootContainer.resolve(API_BASE_TOKEN);
  api.baseUrl = config.getAPIBaseUrl();
  api.defaultRequestTimeout = config.defaultRequestTimeout;
  api.onRequest = [
    authenticationService.onRequest.bind(authenticationService),
    logService.onRequest.bind(logService),
  ];
  api.onResponseFulfilled = [
    logService.onResponseFulfilled.bind(logService),
    rootContainer.resolve(BackendVersionService).onResponseFulfilled.bind(rootContainer.resolve(BackendVersionService)),
  ];
  api.onResponseRejected = [
    logService.onResponseRejected.bind(logService),
    authenticationService.onResponseRejected.bind(authenticationService),
  ];

  const queryClientService = container.resolve(QueryClientService);
  const emotionCache = container.resolve(EmotionCacheService).emotionCache;

  return (
    <ClientCommonConfigContextProvider container={container}>
      <QueryClientProvider client={queryClientService.queryClient}>
        <CacheProvider value={emotionCache}>
          <ThemeProvider theme={config.theme}>
            <CssBaseline />
            <ErrorBoundary FallbackComponent={ErrorPage}>
              <ApplicationBootstrapWithoutAuthorization>
                <AppRouterProvider />
              </ApplicationBootstrapWithoutAuthorization>
            </ErrorBoundary>
          </ThemeProvider>
        </CacheProvider>
      </QueryClientProvider>
    </ClientCommonConfigContextProvider>
  );
};

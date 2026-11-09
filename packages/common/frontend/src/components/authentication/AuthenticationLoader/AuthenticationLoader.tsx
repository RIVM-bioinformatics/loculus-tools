import {
  useEffect,
  useRef,
} from 'react';
import type { PropsWithChildren } from 'react';
import { container } from 'tsyringe';

import { LoculusService } from '../../../classes/services/LoculusService';
import { UrlService } from '../../../classes/services/UrlService';

export type AuthenticationLoaderProps = PropsWithChildren;

export const AuthenticationLoader = ({ children }: AuthenticationLoaderProps) => {
  const authenticationStartedRef = useRef(false);

  useEffect(() => {
    if (authenticationStartedRef.current) {
      return;
    }
    authenticationStartedRef.current = true;

    const initializeAuthentication = async () => {
      try {
        const urlService = container.resolve(UrlService);

        if (!urlService.hasAuthParams()) {
          console.error('Missing authentication parameters in URL.');
          return;
        }

        const { authClientId, authEndpoint, authRealm } = urlService.data;
        await container.resolve(LoculusService).init({
          authClientId,
          authEndpoint,
          authRealm,
        });
      } catch (error) {
        console.error('Failed to initialize authentication:', error);
      }
    };

    void initializeAuthentication();
  }, []);

  return (
    <>
      {children}
    </>
  );
};

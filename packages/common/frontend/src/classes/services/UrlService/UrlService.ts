import { SubscribableAbstract } from '@gen-epix/ui-core/classes/abstracts/SubscribableAbstract';
import { WindowService } from '@gen-epix/ui-core/classes/services/WindowService';
import {
  inject,
  singleton,
} from 'tsyringe';
import { Subject } from '@gen-epix/ui-core/classes/Subject';

import type { UrlParams } from '../../../models/url.models';
import { UrlUtil } from '../../../utils/UrlUtil';

type UrlParamsWithAuth = Required<Pick<UrlParams, 'authClientId' | 'authEndpoint' | 'authRealm'>> & UrlParams;
type UrlParamsWithReturn = Required<Pick<UrlParams, 'organism' | 'returnUrl'>> & UrlParams;

@singleton()
export class UrlService extends SubscribableAbstract<UrlParams> {
  private readonly windowService: WindowService;

  public constructor(
    @inject(WindowService) windowService: WindowService,
  ) {
    super(new Subject<UrlParams>({}));
    this.windowService = windowService;

    this.windowService.window.addEventListener('hashchange', this.updateParams);
    this.windowService.window.addEventListener('popstate', this.updateParams);
    this.updateParams();
  }

  public static getParamsFromUrl(url: string): UrlParams {
    const urlObject = new URL(url);
    const urlParams = new URLSearchParams(urlObject.search);
    const authEndpointFromUrl = urlParams.get('auth-endpoint');
    const inputFastaUrlFromUrl = urlParams.get('input-fasta');
    const inputMetadataUrlFromUrl = urlParams.get('input-metadata');
    const returnUrlFromUrl = urlParams.get('return-url');

    let authEndpoint = authEndpointFromUrl && UrlUtil.isValidResourceUrl(authEndpointFromUrl) ? authEndpointFromUrl : undefined;
    let inputFastaUrl = inputFastaUrlFromUrl && UrlUtil.isValidResourceUrl(inputFastaUrlFromUrl) ? inputFastaUrlFromUrl : undefined;
    let inputMetadataUrl = inputMetadataUrlFromUrl && UrlUtil.isValidResourceUrl(inputMetadataUrlFromUrl) ? inputMetadataUrlFromUrl : undefined;
    let returnUrl = returnUrlFromUrl && UrlUtil.isValidResourceUrl(returnUrlFromUrl) ? returnUrlFromUrl : undefined;

    // validate that each URL has the same top-level domain:
    const topLevelDomains = [authEndpoint, inputFastaUrl, inputMetadataUrl, returnUrl]
      .filter((u): u is string => u !== undefined)
      .map((u) => {
        try {
          const hostname = new URL(u).hostname;
          const parts = hostname.split('.');
          return parts.slice(-2).join('.');
        } catch {
          return '';
        }
      });
    if (topLevelDomains.length > 1 && new Set(topLevelDomains).size > 1) {
      console.warn('URLs have mismatched top-level domains. Clearing all URL parameters.');
      authEndpoint = undefined;
      inputFastaUrl = undefined;
      inputMetadataUrl = undefined;
      returnUrl = undefined;
    }

    return {
      authClientId: urlParams.get('auth-client-id') ?? undefined,
      authEndpoint,
      authRealm: urlParams.get('auth-realm') ?? undefined,
      inputFastaUrl,
      inputMetadataUrl,
      organism: urlParams.get('organism') ?? undefined,
      returnUrl,
    };
  }

  public hasAuthParams(): this is { data: UrlParamsWithAuth } & this {
    return this.data.authClientId !== undefined &&
      this.data.authEndpoint !== undefined &&
      this.data.authRealm !== undefined;
  }

  public hasReturnParams(): this is { data: UrlParamsWithReturn } & this {
    return this.data.returnUrl !== undefined &&
      this.data.organism !== undefined;
  }

  private readonly updateParams = (): void => {
    this.next(UrlService.getParamsFromUrl(this.windowService.document.location.href));
  };
}

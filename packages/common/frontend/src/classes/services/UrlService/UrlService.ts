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
    const authEndpoint = urlParams.get('auth-endpoint') ?? undefined;
    const inputFastaUrl = urlParams.get('input-fasta') ?? undefined;
    const inputMetadataUrl = urlParams.get('input-metadata') ?? undefined;
    const returnUrl = urlParams.get('return-url') ?? undefined;

    return {
      authClientId: urlParams.get('auth-client-id') ?? undefined,
      authEndpoint: authEndpoint && UrlUtil.isValidResourceUrl(authEndpoint) ? authEndpoint : undefined,
      authRealm: urlParams.get('auth-realm') ?? undefined,
      inputFastaUrl: inputFastaUrl && UrlUtil.isValidResourceUrl(inputFastaUrl) ? inputFastaUrl : undefined,
      inputMetadataUrl: inputMetadataUrl && UrlUtil.isValidResourceUrl(inputMetadataUrl) ? inputMetadataUrl : undefined,
      organism: urlParams.get('organism') ?? undefined,
      returnUrl: returnUrl && UrlUtil.isValidResourceUrl(returnUrl) ? returnUrl : undefined,
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

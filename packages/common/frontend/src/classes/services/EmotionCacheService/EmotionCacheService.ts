import type { EmotionCache } from '@emotion/cache';
import createCache from '@emotion/cache';
import {
  inject,
  singleton,
} from 'tsyringe';
import { WindowService } from '@gen-epix/ui-core/classes/services/WindowService';

import { CONFIG_TOKEN } from '../../../constants/config.constants';
import type { ConfigBase } from '../../../models/config.models';


@singleton()
export class EmotionCacheService {
  public readonly emotionCache: EmotionCache;

  public constructor(
    @inject(CONFIG_TOKEN) config: ConfigBase,
    @inject(WindowService) windowService: WindowService,
  ) {
    this.emotionCache = createCache({
      container: windowService.document.head,
      key: 'loculus-tools',
      nonce: config.nonce,
      prepend: !!config.nonce,
      stylisPlugins: [],
    });
  }
}

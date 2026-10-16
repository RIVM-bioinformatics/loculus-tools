import type { EmotionCache } from '@emotion/cache';
import createCache from '@emotion/cache';
import { WindowService } from '@gen-epix/ui-core/classes/services/WindowService';
import { HmrUtil } from '@gen-epix/ui-core/utils/HmrUtil';

import { NonceUtil } from '../../utils/NonceUtil';


export class EmotionCacheService {
  private static __instance: EmotionCacheService | undefined;
  public readonly emotionCache: EmotionCache;

  private constructor() {
    const nonce = NonceUtil.getNonce();
    this.emotionCache = createCache({
      container: WindowService.getInstance().document.head,
      key: 'rivm-loculus',
      nonce,
      prepend: !!nonce,
      stylisPlugins: [],
    });
  }

  public static getInstance(): EmotionCacheService {
    EmotionCacheService.__instance = HmrUtil.getHmrSingleton('emotionCacheService', EmotionCacheService.__instance, () => new EmotionCacheService());
    return EmotionCacheService.__instance;
  }
}

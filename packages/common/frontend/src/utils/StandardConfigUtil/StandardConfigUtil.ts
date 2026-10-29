import { WindowService } from '@gen-epix/ui-core/classes/services/WindowService';

import type { ConfigBase } from '../../models/config.models';

export class StandardConfigUtil {
  public static createConfig(): Pick<ConfigBase, 'nonce' | 'pageConfig'> {
    return {
      nonce: WindowService.getInstance().document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') ?? undefined,
      pageConfig: {
        appBarHeight: 48,
      },
    };
  }
}

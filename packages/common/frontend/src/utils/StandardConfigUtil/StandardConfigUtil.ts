import type { ConfigBase } from '../../models/config.models';

export class StandardConfigUtil {
  public static createConfig(): Pick<ConfigBase, 'nonce' | 'spinner'> {
    return {
      nonce: document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') ?? undefined,
      spinner: {
        DEFAULT_CIRCULAR_PROGRESS_SIZE: 40,
        DEFAULT_TAKING_LONGER_TIMEOUT_MS: 5000,
      },
    };
  }
}

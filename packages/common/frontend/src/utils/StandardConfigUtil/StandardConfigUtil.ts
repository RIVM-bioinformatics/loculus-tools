import type { ConfigBase } from '../../models/config.models';

export class StandardConfigUtil {
  public static createConfig(): Pick<ConfigBase, 'spinner'> {
    return {
      spinner: {
        DEFAULT_CIRCULAR_PROGRESS_SIZE: 40,
        DEFAULT_TAKING_LONGER_TIMEOUT_MS: 5000,
      },
    };
  }
}

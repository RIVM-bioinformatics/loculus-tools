import { container } from 'tsyringe';
import type { DependencyContainer } from 'tsyringe';

import type { ConfigBase } from '../../models/config.models';
import { CONFIG_TOKEN } from '../../constants/config.constants';

export class DependencyContainerUtil {
  public static registerConfig<TConfig extends ConfigBase>(config: TConfig): void {
    container.register(CONFIG_TOKEN, { useValue: config });
  }

  public static resolveConfig<TConfig extends ConfigBase = ConfigBase>(dependencyContainer: DependencyContainer = container): TConfig {
    return dependencyContainer.resolve(CONFIG_TOKEN) as TConfig;
  }
}

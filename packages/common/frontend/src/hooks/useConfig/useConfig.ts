import type { ConfigBase } from '../../models/config.models';
import { DependencyContainerUtil } from '../../utils/DependencyContainerUtil';

// eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix
export const useConfig = <TConfig extends ConfigBase = ConfigBase>(): TConfig => {
  return DependencyContainerUtil.resolveConfig<TConfig>();
};

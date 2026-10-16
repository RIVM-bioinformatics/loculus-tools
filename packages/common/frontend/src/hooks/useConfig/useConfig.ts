import type { ConfigBase } from '../../models/config.models';
import { useCommonConfigContext } from '../../context/commonConfigContext';

export const useConfig = <TConfig extends ConfigBase = ConfigBase>(): TConfig => {
  return useCommonConfigContext<TConfig>().config;
};

import { use } from 'react';

import type { ConfigBase } from '../../models/config.models';

import type { CommonConfig } from './CommonConfigContext';
import { CommonConfigContext } from './CommonConfigContext';

export const useCommonConfigContext = <TConfig extends ConfigBase = ConfigBase>(): CommonConfig<TConfig> => {
  const config = use(CommonConfigContext);
  if (!config) {
    throw new Error('CommonConfigContext is not available');
  }
  return config as CommonConfig<TConfig>;
};

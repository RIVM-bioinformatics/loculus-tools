import type { CoreComponentsConfig } from '@gen-epix/ui-core-components/context/CoreComponentsConfigContext';
import { createContext } from 'react';
import type { DependencyContainer } from 'tsyringe';

import type { ConfigBase } from '../../models/config.models';

export type CommonConfig<TConfig extends ConfigBase = ConfigBase> = {
  config: TConfig;
  container: DependencyContainer;
  genEpixCoreComponentsConfig: CoreComponentsConfig;
};

export const CommonConfigContext = createContext<CommonConfig | null>(null);

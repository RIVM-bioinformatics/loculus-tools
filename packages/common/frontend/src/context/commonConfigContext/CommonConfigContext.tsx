import type { UiCoreComponentsConfig } from '@gen-epix/ui-core-components/context/uiCoreComponentsConfigContext';
import { createContext } from 'react';
import type { DependencyContainer } from 'tsyringe';

import type { ConfigBase } from '../../models/config.models';

export type CommonConfig<TConfig extends ConfigBase = ConfigBase> = {
  config: TConfig;
  container: DependencyContainer;
  genEpixCoreComponentsConfig: UiCoreComponentsConfig;
};

export const CommonConfigContext = createContext<CommonConfig | null>(null);

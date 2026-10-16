import { useMemo } from 'react';
import type { PropsWithChildren } from 'react';
import { CoreComponentsConfigContext } from '@gen-epix/ui-core-components/context/CoreComponentsConfigContext';
import type { DependencyContainer } from 'tsyringe';

import { DependencyContainerUtil } from '../../utils/DependencyContainerUtil';
import type { ConfigBase } from '../../models/config.models';

import type { CommonConfig } from './CommonConfigContext';
import { CommonConfigContext } from './CommonConfigContext';


export type CommonConfigContextProviderProps = PropsWithChildren<{
  readonly container: DependencyContainer;
}>;

export const CommonConfigContextProvider = (
  props: CommonConfigContextProviderProps,
) => {
  const { children, container } = props;
  const config = DependencyContainerUtil.resolveConfig<ConfigBase>(container);
  const genEpixCoreComponentsConfig = useMemo<CommonConfig['genEpixCoreComponentsConfig']>(() => ({
    spinner: {
      defaultCircularProgressSize: config.spinner.DEFAULT_CIRCULAR_PROGRESS_SIZE!,
      defaultTakingLongerTimeoutMs: config.spinner.DEFAULT_TAKING_LONGER_TIMEOUT_MS,
    },
  }), [config.spinner]);
  const CommonConfig = useMemo(() => ({ config, container, genEpixCoreComponentsConfig }), [config, container, genEpixCoreComponentsConfig]);

  return (
    <CoreComponentsConfigContext value={genEpixCoreComponentsConfig}>
      <CommonConfigContext value={CommonConfig}>
        {children}
      </CommonConfigContext>
    </CoreComponentsConfigContext>
  );
};

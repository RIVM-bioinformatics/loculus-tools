import {
  useId,
  useMemo,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';

import type {
  PageCommonConfig,
  PageCommonContextData,
} from './PageCommonContext';
import { PageCommonContext } from './PageCommonContext';

export type PageCommonContextProviderProps = PropsWithChildren<PageCommonConfig>;

export const PageCommonContextProvider = ({ children, ...props }: PageCommonContextProviderProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNoInteraction, setIsNoInteraction] = useState(false);
  const drawerContainerId = useId();

  const contextValue = useMemo<PageCommonContextData>(() => {
    return {
      ...props,
      drawerContainerId,
      isDrawerOpen,
      isNoInteraction,
      setIsDrawerOpen,
      setIsNoInteraction,
    };
  }, [isDrawerOpen, isNoInteraction, drawerContainerId, props]);

  return (
    <PageCommonContext value={contextValue}>
      { children }
    </PageCommonContext>
  );
};

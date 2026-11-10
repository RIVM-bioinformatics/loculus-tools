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
  const drawerButtonId = useId();

  const contextValue = useMemo<PageCommonContextData>(() => {
    return {
      ...props,
      drawerButtonId,
      drawerContainerId,
      isDrawerOpen,
      isNoInteraction,
      setIsDrawerOpen,
      setIsNoInteraction,
    };
  }, [props, drawerButtonId, drawerContainerId, isDrawerOpen, isNoInteraction]);

  return (
    <PageCommonContext value={contextValue}>
      { children }
    </PageCommonContext>
  );
};

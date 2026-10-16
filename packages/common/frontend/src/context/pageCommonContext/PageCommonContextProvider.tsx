import {
  useMemo,
  useState,
} from 'react';
import type { PropsWithChildren } from 'react';

import type { PageCommonContextData } from './PageCommonContext';
import { PageCommonContext } from './PageCommonContext';

export type PageCommonContextProviderProps = PropsWithChildren;

export const PageCommonContextProvider = ({ children }: PageCommonContextProviderProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNoInteraction, setIsNoInteraction] = useState(false);

  const contextValue = useMemo<PageCommonContextData>(() => {
    return {
      isDrawerOpen,
      isNoInteraction,
      setIsDrawerOpen,
      setIsNoInteraction,
    };
  }, [isDrawerOpen, isNoInteraction]);

  return (
    <PageCommonContext value={contextValue}>
      { children }
    </PageCommonContext>
  );
};

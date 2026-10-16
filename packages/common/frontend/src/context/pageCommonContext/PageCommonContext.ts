import { createContext } from 'react';

export type PageCommonContextData = {
  readonly isDrawerOpen: boolean;
  readonly isNoInteraction: boolean;
  readonly setIsDrawerOpen: (open: boolean) => void;
  readonly setIsNoInteraction: (open: boolean) => void;
};

export const PageCommonContext = createContext<PageCommonContextData>({
  isDrawerOpen: false,
  isNoInteraction: false,
  setIsDrawerOpen: () => null,
  setIsNoInteraction: () => null,
});

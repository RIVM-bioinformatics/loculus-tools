import { createContext } from 'react';

export type PageCommonContextData = {
  readonly isDrawerOpen: boolean;
  readonly isNoInteraction: boolean;
  readonly setIsDrawerOpen: (open: boolean) => void;
  readonly setIsNoInteraction: (open: boolean) => void;
};

export const PageCommonContext = createContext<null | PageCommonContextData>(null);

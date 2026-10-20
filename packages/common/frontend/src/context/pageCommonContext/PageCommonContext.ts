import type { ReactNode } from 'react';
import { createContext } from 'react';

export type PageCommonConfig = {
  readonly afterAppBarComponent?: ReactNode;
  readonly afterAppBarRightComponent?: ReactNode;
  readonly appBarHeight?: number;
  readonly appBarIcon?: ReactNode;
  readonly beforeAppBarComponent?: ReactNode;
  readonly beforeAppBarRightComponent?: ReactNode;
};

export type PageCommonContextData = {
  readonly drawerContainerId: string;
  readonly isDrawerOpen: boolean;
  readonly isNoInteraction: boolean;
  readonly setIsDrawerOpen: (open: boolean) => void;
  readonly setIsNoInteraction: (open: boolean) => void;
} & PageCommonConfig;

export const PageCommonContext = createContext<PageCommonContextData>({} as PageCommonContextData);

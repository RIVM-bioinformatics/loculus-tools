import type { ReactElement } from 'react';
import type { Theme } from '@mui/material';

import type { PageCommonConfig } from '../context/pageCommonContext';

export interface ConfigBase {
  applicationName: string;
  readonly drawerComponent?: () => ReactElement;
  getTouchIconUrl?: () => string | undefined;
  readonly headerComponent?: () => ReactElement;
  nonce?: string;
  pageConfig?: PageCommonConfig;
  theme: Theme;
}

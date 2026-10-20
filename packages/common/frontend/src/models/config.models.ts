import type { ReactElement } from 'react';
import type {
  CircularProgressProps,
  Theme,
} from '@mui/material';

import type { PageCommonConfig } from '../context/pageCommonContext';

export interface ConfigBase {
  applicationName: string;
  readonly drawerComponent?: () => ReactElement;
  getTouchIconUrl?: () => string | undefined;
  readonly headerComponent?: () => ReactElement;
  nonce?: string;
  pageConfig?: PageCommonConfig;
  spinner: {
    DEFAULT_CIRCULAR_PROGRESS_SIZE: CircularProgressProps['size'];
    DEFAULT_TAKING_LONGER_TIMEOUT_MS: number;
  };
  theme: Theme;
}

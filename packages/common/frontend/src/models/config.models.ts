import type { ReactNode } from 'react';
import type {
  CircularProgressProps,
  Theme,
} from '@mui/material';

export type ApplicationHeaderProps = {
  readonly fullHeight?: boolean;
  readonly fullWidth?: boolean;
  readonly singleAction?: boolean;
};


export interface ConfigBase {
  applicationName: string;
  readonly drawerComponent?: ReactNode;
  getTouchIconUrl: () => string | undefined;
  readonly headerComponent?: ReactNode;
  nonce?: string;
  spinner: {
    DEFAULT_CIRCULAR_PROGRESS_SIZE: CircularProgressProps['size'];
    DEFAULT_TAKING_LONGER_TIMEOUT_MS: number;
  };
  theme: Theme;
}

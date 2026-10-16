import type { ReactElement } from 'react';
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
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ApplicationHeader: (props: ApplicationHeaderProps) => ReactElement;
  nonce?: string;
  spinner: {
    DEFAULT_CIRCULAR_PROGRESS_SIZE: CircularProgressProps['size'];
    DEFAULT_TAKING_LONGER_TIMEOUT_MS: number;
  };
  theme: Theme;
}

/* eslint-disable @typescript-eslint/naming-convention */
import type { ComponentsProps } from '@mui/material/styles';

import type { FastaPageHeaderCenterComponentTheme } from '../components/fasta/FastaPageHeaderCenterComponent';
import type { FastaPageHeaderImportButtonTheme } from '../components/fasta/FastaPageHeaderImportButton';
import type {
  SearchBarNodeCounterProps,
  SearchBarNodeCounterTheme,
} from '../components/ui/SearchBar/SearchBarNodeCounter';
import type {
  ButtonWithMenuProps,
  ButtonWithMenuTheme,
} from '../components/ui/ButtonWithMenu/ButtonWithMenu';
import type {
  PageCommonHeaderProps,
  PageCommonHeaderTheme,
} from '../components/ui/PageCommonHeader';
import type {
  SearchBarProps,
  SearchBarTheme,
} from '../components/ui/SearchBar';

declare module '@mui/material/styles' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Required to augment MUI's generic interface.
  interface Components<TTheme = unknown> {
    RivmLoculusToolsCommonFrontendButtonWithMenu?: {
      defaultProps?: ComponentsProps['RivmLoculusToolsCommonFrontendButtonWithMenu'];
    } & ButtonWithMenuTheme;
    RivmLoculusToolsCommonFrontendFastaPageHeaderCenterComponent?: FastaPageHeaderCenterComponentTheme;
    RivmLoculusToolsCommonFrontendFastaPageHeaderImportButton?: FastaPageHeaderImportButtonTheme;
    RivmLoculusToolsCommonFrontendPageCommonHeader?: {
      defaultProps?: ComponentsProps['RivmLoculusToolsCommonFrontendPageCommonHeader'];
    } & PageCommonHeaderTheme;
    RivmLoculusToolsCommonFrontendSearchBar?: {
      defaultProps?: ComponentsProps['RivmLoculusToolsCommonFrontendSearchBar'];
    } & SearchBarTheme;
    RivmLoculusToolsCommonFrontendSearchBarNodeCounter?: {
      defaultProps?: ComponentsProps['RivmLoculusToolsCommonFrontendSearchBarNodeCounter'];
    } & SearchBarNodeCounterTheme;
  }

  interface ComponentsPropsList {
    RivmLoculusToolsCommonFrontendButtonWithMenu: ButtonWithMenuProps;
    RivmLoculusToolsCommonFrontendPageCommonHeader: PageCommonHeaderProps;
    RivmLoculusToolsCommonFrontendSearchBar: SearchBarProps;
    RivmLoculusToolsCommonFrontendSearchBarNodeCounter: SearchBarNodeCounterProps;
  }
}

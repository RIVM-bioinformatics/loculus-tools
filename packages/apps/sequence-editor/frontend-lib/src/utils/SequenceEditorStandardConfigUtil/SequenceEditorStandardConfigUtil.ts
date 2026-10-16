import { StandardConfigUtil } from '@rivm-loculus-tools/common-frontend/utils/StandardConfigUtil';
import { createElement } from 'react';

import type { SequenceEditorConfig } from '../../models/config.models';
import { SequenceEditorPageDrawer } from '../../components/ui/SequenceEditorPageDrawer';
import { SequenceEditorPageHeader } from '../../components/ui/SequenceEditorPageHeader';


export class SequenceEditorStandardConfigUtil {
  public static createConfig(): Omit<SequenceEditorConfig, 'theme'> {

    const config: Omit<SequenceEditorConfig, 'theme'> = {
      ...StandardConfigUtil.createConfig(),
      applicationName: 'Sequence Editor',
      drawerComponent: createElement(SequenceEditorPageDrawer),
      getTouchIconUrl: () => {
        return undefined;
      },
      headerComponent: createElement(SequenceEditorPageHeader),
    };

    return config;
  }

}

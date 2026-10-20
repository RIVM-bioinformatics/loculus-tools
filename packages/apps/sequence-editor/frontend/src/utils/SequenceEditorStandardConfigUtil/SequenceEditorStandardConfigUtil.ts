import { StandardConfigUtil } from '@rivm-loculus-tools/common-frontend/utils/StandardConfigUtil';

import type { SequenceEditorConfig } from '../../models/config.models';
import { SequenceEditorPageDrawer } from '../../components/ui/SequenceEditorPageDrawer';
import { SequenceEditorPageHeader } from '../../components/ui/SequenceEditorPageHeader';


export class SequenceEditorStandardConfigUtil {
  public static createConfig(): Pick<SequenceEditorConfig, 'applicationName' | 'drawerComponent' | 'headerComponent'> & ReturnType<typeof StandardConfigUtil.createConfig> {
    return {
      ...StandardConfigUtil.createConfig(),
      applicationName: 'MindTheGap',
      drawerComponent: SequenceEditorPageDrawer,
      headerComponent: SequenceEditorPageHeader,
    };
  }
}

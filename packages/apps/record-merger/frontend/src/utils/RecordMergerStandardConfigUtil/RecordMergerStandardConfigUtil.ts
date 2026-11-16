import { StandardConfigUtil } from '@rivm-loculus-tools/common-frontend/utils/StandardConfigUtil';

import { RecordMergerPageDrawer } from '../../components/ui/RecordMergerPageDrawer';
import { RecordMergerPageHeader } from '../../components/ui/RecordMergerPageHeader';
import type { RecordMergerConfig } from '../../models/config.models';

export class RecordMergerStandardConfigUtil {
  public static createConfig(): Pick<RecordMergerConfig, 'applicationName' | 'drawerComponent' | 'headerComponent'> & ReturnType<typeof StandardConfigUtil.createConfig> {
    return {
      ...StandardConfigUtil.createConfig(),
      applicationName: 'Record Merger',
      drawerComponent: RecordMergerPageDrawer,
      headerComponent: RecordMergerPageHeader,
    };
  }
}

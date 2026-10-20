import { StandardConfigUtil } from '@rivm-loculus-tools/common-frontend/utils/StandardConfigUtil';

import type { PhylogenyViewerConfig } from '../../models/config.models';
import { PhylogenyViewerPageDrawer } from '../../components/ui/PhylogenyViewerPageDrawer';
import { PhylogenyViewerPageHeader } from '../../components/ui/PhylogenyViewerPageHeader';


export class PhylogenyViewerStandardConfigUtil {
  public static createConfig(): Pick<PhylogenyViewerConfig, 'applicationName' | 'drawerComponent' | 'headerComponent'> & ReturnType<typeof StandardConfigUtil.createConfig> {
    return {
      ...StandardConfigUtil.createConfig(),
      applicationName: 'Phylogeny Viewer',
      drawerComponent: PhylogenyViewerPageDrawer,
      headerComponent: PhylogenyViewerPageHeader,
    };
  }
}

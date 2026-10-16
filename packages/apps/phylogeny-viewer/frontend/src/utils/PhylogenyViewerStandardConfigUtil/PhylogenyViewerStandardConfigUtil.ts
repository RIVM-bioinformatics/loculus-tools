import { StandardConfigUtil } from '@rivm-loculus-tools/common-frontend/utils/StandardConfigUtil';

import type { PhylogenyViewerConfig } from '../../models/config.models';
import { PhylogenyViewerPageDrawer } from '../../components/ui/PhylogenyViewerPageDrawer';
import { PhylogenyViewerPageHeader } from '../../components/ui/PhylogenyViewerPageHeader';


export class PhylogenyViewerStandardConfigUtil {
  public static createConfig(): Omit<PhylogenyViewerConfig, 'theme'> {

    const config: Omit<PhylogenyViewerConfig, 'theme'> = {
      ...StandardConfigUtil.createConfig(),
      applicationName: 'Phylogeny Viewer',
      drawerComponent: PhylogenyViewerPageDrawer,
      getTouchIconUrl: () => {
        return undefined;
      },
      headerComponent: PhylogenyViewerPageHeader,
    };

    return config;
  }

}

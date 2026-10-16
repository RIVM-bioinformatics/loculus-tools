import { StandardConfigUtil } from '@rivm-loculus-tools/common-frontend/utils/StandardConfigUtil';
import { createElement } from 'react';

import type { PhylogenyViewerConfig } from '../../models/config.models';
import { PhylogenyViewerPageDrawer } from '../../components/ui/PhylogenyViewerPageDrawer';
import { PhylogenyViewerPageHeader } from '../../components/ui/PhylogenyViewerPageHeader';


export class PhylogenyViewerStandardConfigUtil {
  public static createConfig(): Omit<PhylogenyViewerConfig, 'theme'> {

    const config: Omit<PhylogenyViewerConfig, 'theme'> = {
      ...StandardConfigUtil.createConfig(),
      applicationName: 'Phylogeny Viewer',
      drawerComponent: createElement(PhylogenyViewerPageDrawer),
      getTouchIconUrl: () => {
        return undefined;
      },
      headerComponent: createElement(PhylogenyViewerPageHeader),
    };

    return config;
  }

}

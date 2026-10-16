import type { PhylogenyViewerConfig } from '@rivm-loculus-tools/phylogeny-viewer/models/config.models';
import { PhylogenyViewerStandardConfigUtil } from '@rivm-loculus-tools/phylogeny-viewer/utils/PhylogenyViewerStandardConfigUtil';
import { theme } from '@rivm-loculus-tools/common-frontend/theme';

export class ConfigUtil {
  public static createConfig(): PhylogenyViewerConfig {
    const config: PhylogenyViewerConfig = {
      ...PhylogenyViewerStandardConfigUtil.createConfig(),
      theme,
    };

    return config;
  }
}

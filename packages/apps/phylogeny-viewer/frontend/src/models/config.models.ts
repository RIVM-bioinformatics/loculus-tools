import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import type { ConfigBase } from '@rivm-loculus-tools/common-frontend/models/config.models';

export interface PhylogenyViewerConfig extends ConfigBase {
  aioli?: {
    cdnUrl?: string;
    fasttreeTool?: string;
    tn93Tool?: string;
  };
  fastaImportExtraActions?: DialogAction[];
}

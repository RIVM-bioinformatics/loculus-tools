import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import type { ConfigBase } from '@rivm-loculus-tools/common-frontend/models/config.models';

export interface RecordMergerConfig extends ConfigBase {
  aioli?: {
    cdnUrl?: string;
    minimap2Tool?: string;
    samtoolsTool?: string;
  };
  fastaImportExtraActions?: DialogAction[];
}

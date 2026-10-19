import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import type { ConfigBase } from '@rivm-loculus-tools/common-frontend/models/config.models';

export interface SequenceEditorConfig extends ConfigBase {
  fastaImportExtraActions?: DialogAction[];
}

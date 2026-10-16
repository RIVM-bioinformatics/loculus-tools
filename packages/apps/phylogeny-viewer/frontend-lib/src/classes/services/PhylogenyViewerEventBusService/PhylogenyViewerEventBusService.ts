import { EventBusAbstract } from '@gen-epix/ui-core/classes/abstracts/EventBusAbstract';
import { singleton } from 'tsyringe';

import type { TREE_DOWNLOAD_TYPE } from '../../../models/tree.models';

export type PhylogenyViewerEventBusServiceEvent = {
  onDownloadCanvas: TREE_DOWNLOAD_TYPE;
  onShowAlignmentErrorDialog: void;
};

@singleton()
export class PhylogenyViewerEventBusService extends EventBusAbstract<PhylogenyViewerEventBusServiceEvent> {
  public constructor() {
    super();
  }
}

import { EventBusAbstract } from '@gen-epix/ui-core/classes/abstracts/EventBusAbstract';
import { HmrUtil } from '@gen-epix/ui-core/utils/HmrUtil';

import type { TREE_DOWNLOAD_TYPE } from '../../../models/tree';

export type PhylogenyViewerEventBusServiceEvent = {
  onDownloadCanvas: TREE_DOWNLOAD_TYPE;
  onShowAlignmentErrorDialog: void;
};

export class PhylogenyViewerEventBusService extends EventBusAbstract<PhylogenyViewerEventBusServiceEvent> {
  private static __instance: PhylogenyViewerEventBusService;


  private constructor() {
    super();
  }

  public static getInstance(): PhylogenyViewerEventBusService {
    PhylogenyViewerEventBusService.__instance = HmrUtil.getHmrSingleton('phylogenyViewerEventBusService', PhylogenyViewerEventBusService.__instance, () => new PhylogenyViewerEventBusService());
    return PhylogenyViewerEventBusService.__instance;
  }
}

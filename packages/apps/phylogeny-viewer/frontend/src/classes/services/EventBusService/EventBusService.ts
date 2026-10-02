import { EventBusAbstract } from '@gen-epix/ui-core/classes/abstracts/EventBusAbstract';
import { HmrUtil } from '@gen-epix/ui-core/utils/HmrUtil';

import type { TREE_DOWNLOAD_TYPE } from '../../../models/tree';

export type Event = {
  onDownloadCanvas: TREE_DOWNLOAD_TYPE;
  onShowAlignmentErrorDialog: void;
  onToggleDrawer: boolean;
};

export class EventBusService extends EventBusAbstract<Event> {
  private static __instance: EventBusService;


  private constructor() {
    super();
  }

  public static getInstance(): EventBusService {
    EventBusService.__instance = HmrUtil.getHmrSingleton('eventBusService', EventBusService.__instance, () => new EventBusService());
    return EventBusService.__instance;
  }
}

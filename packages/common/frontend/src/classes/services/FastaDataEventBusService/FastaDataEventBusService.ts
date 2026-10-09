import { EventBusAbstract } from '@gen-epix/ui-core/classes/abstracts/EventBusAbstract';
import { HmrUtil } from '@gen-epix/ui-core/utils/HmrUtil';


export type Event = {
  onCloseImportDialog: undefined;
  onShowImportDialog: string | undefined;
};

export class FastaDataEventBusService extends EventBusAbstract<Event> {
  private static __instance: FastaDataEventBusService;


  private constructor() {
    super();
  }

  public static getInstance(): FastaDataEventBusService {
    FastaDataEventBusService.__instance = HmrUtil.getHmrSingleton('fastaDataEventBusService', FastaDataEventBusService.__instance, () => new FastaDataEventBusService());
    return FastaDataEventBusService.__instance;
  }
}

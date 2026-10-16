import { EventBusAbstract } from '@gen-epix/ui-core/classes/abstracts/EventBusAbstract';
import { singleton } from 'tsyringe';


export type Event = {
  onCloseImportDialog: undefined;
  onShowImportDialog: string | undefined;
};

@singleton()
export class FastaDataEventBusService extends EventBusAbstract<Event> {
  public constructor() {
    super();
  }
}

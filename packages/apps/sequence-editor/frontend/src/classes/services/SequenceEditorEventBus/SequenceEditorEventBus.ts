import { EventBusAbstract } from '@gen-epix/ui-core/classes/abstracts/EventBusAbstract';
import { HmrUtil } from '@gen-epix/ui-core/utils/HmrUtil';

import type { EDITOR_DIRECTION } from '../../../models/editor';

export type SequenceEditorEventBusServiceEvent = {
  onDeleteBackward: void;
  onExpandSelection: EDITOR_DIRECTION;
  onGotoPosition: void;
  onInsert: void;
  onMoveCells: EDITOR_DIRECTION;
  onMoveRows: EDITOR_DIRECTION;
  onMoveRowsEnd: EDITOR_DIRECTION;
  onMoveSelection: EDITOR_DIRECTION;
  onMutateSelection: string;
  onRedo: void;
  onScrollPageDown: void;
  onScrollPageUp: void;
  onScrollToLineEnd: void;
  onScrollToLineStart: void;
  onUndo: void;
};

export class SequenceEditorEventBusService extends EventBusAbstract<SequenceEditorEventBusServiceEvent> {
  private static __instance: SequenceEditorEventBusService;


  private constructor() {
    super();
  }

  public static getInstance(): SequenceEditorEventBusService {
    SequenceEditorEventBusService.__instance = HmrUtil.getHmrSingleton('SequenceEditorEventBusService', SequenceEditorEventBusService.__instance, () => new SequenceEditorEventBusService());
    return SequenceEditorEventBusService.__instance;
  }
}

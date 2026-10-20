import { EventBusAbstract } from '@gen-epix/ui-core/classes/abstracts/EventBusAbstract';
import { singleton } from 'tsyringe';

import type { EDITOR_DIRECTION } from '../../../models/editor.models';

export type SequenceEditorEventBusServiceEvent = {
  onDeleteBackward: void;
  onExpandSelection: EDITOR_DIRECTION;
  onExportGappedFasta: void;
  onExportUngappedFasta: void;
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
  onSearch: string;
  onUndo: void;
};

@singleton()
export class SequenceEditorEventBusService extends EventBusAbstract<SequenceEditorEventBusServiceEvent> {
  public constructor() {
    super();
  }
}

import { Subject } from '@gen-epix/ui-core/classes/Subject';
import { SubscribableAbstract } from '@gen-epix/ui-core/classes/abstracts/SubscribableAbstract';
import { HmrUtil } from '@gen-epix/ui-core/utils/HmrUtil';

import type {
  EditorSelection,
  EngineMeta,
} from '../../../models';

export type SequenceEditorStatsSubscribableData = {
  latestMessage: null | string;
  meta: EngineMeta | null;
  selection: EditorSelection | null;
};

export class SequenceEditorStatsSubscribable extends SubscribableAbstract<SequenceEditorStatsSubscribableData> {
  private static __instance: SequenceEditorStatsSubscribable;

  private constructor() {
    super(new Subject<SequenceEditorStatsSubscribableData>({ latestMessage: null, meta: null, selection: null }));
  }

  public static getInstance(): SequenceEditorStatsSubscribable {
    SequenceEditorStatsSubscribable.__instance = HmrUtil.getHmrSingleton('sequenceEditorStatsSubscribable', SequenceEditorStatsSubscribable.__instance, () => new SequenceEditorStatsSubscribable());
    return SequenceEditorStatsSubscribable.__instance;
  }

}

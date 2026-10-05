import { SequenceEditor } from '../../ui/SequenceEditor';
import { SequenceEditorPage } from '../../ui/SequenceEditorPage';


export const SequenceEditorMainPage = () => {
  return (
    <SequenceEditorPage
      isNoInteraction={false}
    >
      <SequenceEditor />
    </SequenceEditorPage>
  );
};

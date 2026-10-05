import { SeqEditor } from '../../ui/SeqEditor';
import { SeqEditorPage } from '../../ui/SeqEditorPage';


export const SeqenceEditorMainPage = () => {
  return (
    <SeqEditorPage
      isNoInteraction={false}
    >
      <SeqEditor />
    </SeqEditorPage>
  );
};

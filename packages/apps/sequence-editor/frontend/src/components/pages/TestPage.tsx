import { Editor } from '../editor/Editor';
import { SeqEditorPage } from '../ui/SeqEditorPage';


export const TestPage = () => {
  return (
    <SeqEditorPage
      isNoInteraction={false}
    >
      <Editor />
    </SeqEditorPage>
  );
};

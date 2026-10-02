import { Editor } from '../editor/Editor';
import { SeqEditorPage } from '../ui/SeqEditorPage';


export const MainPage = () => {
  return (
    <SeqEditorPage
      isNoInteraction={false}
    >
      <Editor />
    </SeqEditorPage>
  );
};

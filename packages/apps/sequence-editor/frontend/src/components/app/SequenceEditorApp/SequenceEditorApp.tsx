import { App } from '@rivm-loculus-tools/common-frontend/components/app/App';
import { useEffect } from 'react';
import { container } from 'tsyringe';

import { SequenceEditorMainPage } from '../../../pages/SequenceEditorMainPage';
import { EditorWorkerService } from '../../../classes/services/EditorWorkerService';

export const SequenceEditorApp = () => {
  useEffect(() => {
    const performInitialization = async () => {
      try {
        // initialize here so prefetch works.
        await container.resolve(EditorWorkerService).initialize();
      } catch (error) {
        console.error(error);
      }
    };
    void performInitialization();
  }, []);

  return (
    <App>
      <SequenceEditorMainPage />
    </App>
  );
};

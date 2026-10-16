import type { DependencyContainer } from 'tsyringe';
import { App } from '@rivm-loculus-tools/common-frontend/components/app/App';

import { SequenceEditorMainPage } from '../../../pages/SequenceEditorMainPage';

export type SequenceEditorAppProps = {
  readonly container: DependencyContainer;
};

export const SequenceEditorApp = ({ container }: SequenceEditorAppProps) => {
  return (
    <App container={container}>
      <SequenceEditorMainPage />
    </App>
  );
};

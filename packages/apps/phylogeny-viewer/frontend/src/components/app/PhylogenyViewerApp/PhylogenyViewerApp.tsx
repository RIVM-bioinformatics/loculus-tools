import type { DependencyContainer } from 'tsyringe';
import { App } from '@rivm-loculus-tools/common-frontend/components/app/App';

import { PhylogenyViewerPageMainPage } from '../../../pages/PhylogenyViewerPageMainPage';

export type PhylogenyViewerAppProps = {
  readonly container: DependencyContainer;
};

export const PhylogenyViewerApp = ({ container }: PhylogenyViewerAppProps) => {
  return (
    <App container={container}>
      <PhylogenyViewerPageMainPage />
    </App>
  );
};

import 'reflect-metadata';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PhylogenyViewerApp } from '@rivm-loculus-tools/phylogeny-viewer/components/app/PhylogenyViewerApp';
import { DependencyContainerUtil } from '@rivm-loculus-tools/common-frontend/utils/DependencyContainerUtil';

import { ConfigUtil } from './utils/ConfigUtil';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root container not found in document.');
}

const config = ConfigUtil.createConfig();
const container = DependencyContainerUtil.createContainer(config);

createRoot(rootElement).render(
  <StrictMode>
    <PhylogenyViewerApp
      container={container}
    />
  </StrictMode>,
);

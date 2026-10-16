import 'reflect-metadata';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SequenceEditorApp } from '@rivm-loculus-tools/sequence-editor/components/app/App';
import { DependencyContainerUtil } from '@rivm-loculus-tools/common-frontend/utils/DependencyContainerUtil';

import { ConfigUtil } from './utils/ConfigUtil';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found in document.');
}

const config = ConfigUtil.createConfig();
const dependencyContainer = DependencyContainerUtil.createContainer(config);

createRoot(container).render(
  <StrictMode>
    <SequenceEditorApp container={dependencyContainer} />
  </StrictMode>,
);

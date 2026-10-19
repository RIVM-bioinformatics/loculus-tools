import 'reflect-metadata';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { PhylogenyViewerDemoApp } from './components/app/PhylogenyViewerDemoApp/PhylogenyViewerDemoApp';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root container not found in document.');
}

createRoot(rootElement).render(
  <StrictMode>
    <PhylogenyViewerDemoApp />
  </StrictMode>,
);

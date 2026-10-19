import 'reflect-metadata';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { SequenceEditorDemoApp } from './SequenceEditorDemoApp';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found in document.');
}

createRoot(container).render(
  <StrictMode>
    <SequenceEditorDemoApp />
  </StrictMode>,
);

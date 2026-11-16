import 'reflect-metadata';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { RecordMergerDemoApp } from './components/app/RecordMergerDemoApp/RecordMergerDemoApp';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root container not found in document.');
}

createRoot(rootElement).render(
  <StrictMode>
    <RecordMergerDemoApp />
  </StrictMode>,
);

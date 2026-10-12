import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@rivm-loculus-tools/sequence-editor/components/app/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found in document.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

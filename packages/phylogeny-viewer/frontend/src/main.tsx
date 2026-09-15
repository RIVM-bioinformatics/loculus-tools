import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './components/app/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found in document.');
}

const root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

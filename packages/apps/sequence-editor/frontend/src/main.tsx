import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';

import { App } from './components/app/App/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found in document.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

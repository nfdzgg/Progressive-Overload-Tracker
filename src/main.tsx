import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design';
import { App } from './app/App';

document.documentElement.dataset.build = __APP_BUILD__;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

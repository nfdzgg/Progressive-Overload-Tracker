import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design';
import { App } from './app/App';
import { startPwa } from './app/pwa';
import { installTestHooks } from './app/testHooks';

document.documentElement.dataset.build = __APP_BUILD__;
installTestHooks();
void startPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

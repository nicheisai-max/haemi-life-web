import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// INSTITUTIONAL BOOTSTRAP: Capture precise start time for network layer grace periods
window.__HAEMI_BOOT_TIME__ = Date.now();

import './styles/brand.css'
import '@fontsource/roboto/100.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/roboto/900.css';
// Signature Fonts locally imported
import '@fontsource/great-vibes';
import '@fontsource/sacramento';
import '@fontsource/allura';
import App from './app.tsx'

// DEFENSIVE SAFEGUARD: Hard-block PWA installability signals
// This prevents the 'beforeinstallprompt' event from propagating, 
// ensuring the browser never shows an automated install banner.
window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  return false;
});

import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

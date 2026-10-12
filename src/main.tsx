import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import '@fontsource/great-vibes';
import './theme/tokens.css';
import './theme/app.css';
import './theme/motion.css';
import { App } from './App';
import { keepUpdated } from './lib/updates';

// Theme color fades are enabled after the first frames so loading never animates the background.
requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('theme-ready')));

keepUpdated();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

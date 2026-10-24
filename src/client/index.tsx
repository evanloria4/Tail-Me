import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../styles/main.css';
import { applyTheme } from './lib/theme';
import { registerServiceWorker } from './lib/push';

import App from './App';

// Before first render, so a saved dark choice doesn't flash light
applyTheme();
// Push notifications + installing to the home screen
registerServiceWorker();

const root = createRoot(document.getElementById('app')!);

root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

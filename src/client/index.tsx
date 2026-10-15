import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../styles/main.css';
import { applyTheme } from './lib/theme';

import App from './App';

// Before first render, so a saved dark choice doesn't flash light
applyTheme();

const root = createRoot(document.getElementById('app')!);

root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

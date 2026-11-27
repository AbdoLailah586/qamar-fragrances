import React from 'react';
import ReactDOM from 'react-dom/client';
import { initBotId } from 'botid/client/core';
import App from './App';
import './index.css';
import { initPwa } from './services/pwa';

try {
  initBotId({
    protect: [
      { path: '/api/store', method: '*' },
      { path: '/api/send-otp', method: 'POST' },
      { path: '/api/verify-otp', method: 'POST' },
      { path: '/api/google-auth', method: 'POST' }
    ]
  });
} catch {}

initPwa(true);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

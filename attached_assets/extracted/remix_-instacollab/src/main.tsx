import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch(err => console.error('SW unregistration failed: ', err));
}

// Intercept console.error to swallow Google Maps billing and API key warnings/errors
// since the user wants to test without billing.
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && (args[0].includes('Geocoding Service') || args[0].includes('GEOCODER_GEOCODE: REQUEST_DENIED'))) {
    console.warn("Suppressed Google Maps Error:", ...args);
    return;
  }
  originalError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

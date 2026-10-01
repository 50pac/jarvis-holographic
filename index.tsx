import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { configureTextBuilder } from 'troika-three-text';
import orbitronFontUrl from '@fontsource/orbitron/files/orbitron-latin-700-normal.woff?url';
import './index.css';

configureTextBuilder({
  defaultFontURL: orbitronFontUrl,
  unicodeFontsURL: `${import.meta.env.BASE_URL}fonts/unicode/`,
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

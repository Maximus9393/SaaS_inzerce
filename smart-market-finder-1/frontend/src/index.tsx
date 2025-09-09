import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/main.css';
// Provide DOMPurify globally so pages can sanitize incoming HTML safely
(async () => {
  try {
    const mod = await import('dompurify');
    // dompurify exports a factory that needs the window reference in browser
    // @ts-ignore
    if (typeof window !== 'undefined' && mod) (window as any).DOMPurify = mod.default ? mod.default(window) : (mod as any)(window);
  } catch (e) { /* ignore if DOMPurify not installed in environment */ }
})();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
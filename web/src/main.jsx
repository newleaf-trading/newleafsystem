import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import { ToastProvider } from './shared/context/ToastContext';

// Design tokens (must be first)
import './shared/styles/tokens.css';

// Trading styles (includes Tailwind)
import './trading/styles/app.css';
import './trading/styles/redesign.css';
import './trading/styles/nl-nav.css';

// Analysis components light theme
import './trading/styles/ai-analysis-light.css';

// Blog styles
import './blog/styles/blog.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);

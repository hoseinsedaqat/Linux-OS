import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/vazirmatn';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/apps.css';
import './styles/games.css';
import './styles/media.css';
import './styles/code.css';
import './styles/docs.css';
import App from './app/App';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { registerServiceWorker } from './core/pwa/register';

registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

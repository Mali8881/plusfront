import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initSentry } from './utils/sentry.js'
import './index.css'

initSentry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

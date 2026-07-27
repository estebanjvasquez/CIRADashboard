import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

function App() {
  return (
    <main className="app-shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">CIRA</p>
          <h1>Bot Metrics Dashboard</h1>
        </div>
        <a className="health-link" href={`${apiBaseUrl}/health`}>
          API Health
        </a>
      </section>
      <section className="status-panel">
        <h2>MVP setup ready</h2>
        <p>
          Cloudflare Access protects this hostname. The next API milestone is
          connecting Supabase summary metrics from <code>audit_log_entries</code>.
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

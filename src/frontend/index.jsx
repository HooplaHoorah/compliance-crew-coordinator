import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { invoke } from '@forge/bridge';

const severityColors = {
  high: '#DE350B',
  medium: '#FFAB00',
  low: '#36B37E'
};

const App = () => {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(false);

  const runAudit = async () => {
    setLoading(true);
    try {
      const result = await invoke('runAudit');
      setFlags(result?.flags || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ fontFamily: 'Arial, sans-serif', padding: '16px' }}>
      <h2 style={{ marginBottom: '12px' }}>Compliance Crew Coordinator</h2>
      <p style={{ marginBottom: '12px' }}>
        Run a quick compliance audit to review risk signals tied to this issue.
      </p>
      <button
        onClick={runAudit}
        disabled={loading}
        style={{
          backgroundColor: '#0052CC',
          color: '#FFFFFF',
          padding: '8px 16px',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer'
        }}
      >
        {loading ? 'Running...' : 'Run Compliance Audit'}
      </button>

      <section style={{ marginTop: '16px' }}>
        {flags.length === 0 && !loading && (
          <p style={{ color: '#5E6C84' }}>No audit results yet. Start a scan to view findings.</p>
        )}
        {flags.map((flag) => (
          <div
            key={flag.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              border: '1px solid #DFE1E6',
              borderRadius: '3px',
              marginBottom: '8px'
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: severityColors[flag.severity] || '#C1C7D0',
                marginRight: '8px'
              }}
            />
            <div>
              <strong style={{ textTransform: 'capitalize' }}>{flag.severity} severity</strong>
              <div style={{ color: '#172B4D' }}>{flag.message}</div>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));

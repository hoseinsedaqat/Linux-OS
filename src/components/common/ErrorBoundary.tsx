import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort guard: if stored data is corrupted badly enough to crash a
 * render, the user still gets a readable recovery screen instead of a blank
 * page. Data is never wiped automatically.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[NOVA] Unexpected UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          background: '#05080b',
          color: '#dfe9f3',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>NOVA Linux could not render the desktop</h1>
          <p style={{ color: '#9fb0c2', lineHeight: 1.6, fontSize: 14 }}>
            Something went wrong while restoring the simulator session. Your saved files are still in this
            browser. Try reloading first; if the problem persists, reset the simulator storage from the button
            below.
          </p>
          <pre
            style={{
              background: '#0d141c',
              border: '1px solid #223041',
              borderRadius: 10,
              padding: 12,
              fontSize: 12,
              color: '#ff9b9b',
              overflow: 'auto',
              maxHeight: 160,
            }}
          >
            {this.state.error.message}
          </pre>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{
                padding: '9px 16px',
                borderRadius: 9,
                border: '1px solid #2b3b4e',
                background: '#16202b',
                color: '#e8eef6',
                cursor: 'pointer',
              }}
              onClick={() => window.location.reload()}
            >
              Reload simulator
            </button>
            <button
              style={{
                padding: '9px 16px',
                borderRadius: 9,
                border: '1px solid rgba(255,107,107,0.4)',
                background: 'rgba(255,107,107,0.12)',
                color: '#ff9b9b',
                cursor: 'pointer',
              }}
              onClick={() => {
                try {
                  localStorage.removeItem('nova-linux.settings.v1');
                  localStorage.removeItem('nova-linux.launcher.v1');
                  sessionStorage.clear();
                  indexedDB.deleteDatabase('nova-linux-web');
                } finally {
                  window.location.reload();
                }
              }}
            >
              Reset simulator data
            </button>
          </div>
        </div>
      </div>
    );
  }
}

import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SerbisyoToledo render error:', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background: 'var(--color-page-bg, #f3f7fc)',
          color: 'var(--color-text-primary, #1e293b)',
        }}
      >
        <section
          style={{
            width: 'min(100%, 520px)',
            padding: '32px',
            borderRadius: '16px',
            border: '1px solid var(--color-border, #dbe5f1)',
            background: 'var(--color-surface, #ffffff)',
            boxShadow: 'var(--shadow-md, 0 12px 30px rgba(15, 23, 42, 0.12))',
            textAlign: 'center',
          }}
        >
          <h1 style={{ marginBottom: '12px', fontSize: '1.5rem' }}>
            We couldn&apos;t load this page
          </h1>
          <p
            style={{
              marginBottom: '24px',
              color: 'var(--color-text-secondary, #64748b)',
            }}
          >
            SerbisyoToledo hit a temporary loading problem. Reload the page to continue.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => window.location.assign('/')}
            >
              Go to home
            </button>
          </div>
        </section>
      </main>
    );
  }
}

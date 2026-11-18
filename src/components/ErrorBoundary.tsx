import { Component, type ReactNode } from 'react';

/** Keeps one broken page from blanking the whole course; offers a way back. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null; key?: string }> {
  state: { error: Error | null; key?: string } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  static getDerivedStateFromProps(props: { resetKey?: string }, state: { error: Error | null; key?: string }) {
    // Navigating to another page clears the error.
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }
  componentDidCatch(error: Error) {
    console.error('page crashed', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card p-6">
        <div className="kicker">Something went wrong</div>
        <p className="mt-2 text-sm text-ink-soft">This page hit an error. Your progress is saved — reload, or go back to the overview.</p>
        <div className="mt-4 flex gap-3">
          <button className="btn-primary" onClick={() => location.reload()}>Reload</button>
          <button className="btn-ghost" onClick={() => (location.hash = 'home')}>Overview</button>
        </div>
      </div>
    );
  }
}

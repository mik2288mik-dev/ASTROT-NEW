import React from 'react';
export class NeboScreenBoundary extends React.Component<{children: React.ReactNode; onEscape: () => void}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  componentDidCatch(error: Error) { console.error('[nebo-ui] preview render failed', error.name); }
  render() {
    return this.state.failed ? <section className="nebo-screen nebo-fallback" role="alert"><h1>Новый экран не открылся</h1><p>Твои данные сохранены. Можно вернуться к прежнему интерфейсу.</p><button type="button" className="nebo-primary" onClick={this.props.onEscape}>Вернуться к старому дизайну</button></section> : this.props.children;
  }
}

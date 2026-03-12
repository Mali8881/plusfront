
import { Component } from 'react';
import { Sentry } from '../utils/sentry.js';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, eventId: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
    const eventId = Sentry.captureException(error, { extra: info });
    this.setState({ eventId });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, eventId: null });
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="error-boundary">
        <div className="error-boundary__box">
          <div className="error-boundary__icon">⚠</div>
          <h1 className="error-boundary__title">Что-то пошло не так</h1>
          <p className="error-boundary__message">
            {this.state.error?.message || 'Произошла непредвиденная ошибка'}
          </p>
          {this.state.eventId && (
            <p className="error-boundary__message" style={{ fontSize: 12, marginTop: -8 }}>
              ID ошибки: <code>{this.state.eventId}</code>
            </p>
          )}
          <button className="error-boundary__btn" onClick={this.handleReset}>
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }
}

import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
  if (!DSN) return; // Sentry отключён если DSN не задан

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE, // 'development' | 'production'
    // Отправляем только в production
    enabled: import.meta.env.PROD,
    // Трассировка производительности — 10% запросов
    tracesSampleRate: 0.1,
    // Replay ошибок — 100% при ошибках, 0% обычных сессий
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
  });
}

export { Sentry };

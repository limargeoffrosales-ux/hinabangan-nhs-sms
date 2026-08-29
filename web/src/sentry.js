import * as Sentry from '@sentry/react';
import { browserTracingIntegration, replayIntegration } from '@sentry/browser';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.log('Sentry DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'development',
    integrations: [
      browserTracingIntegration(),
      replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    beforeSend(event) {
      // Scrub PII from error events
      if (event.user) {
        event.user = {
          id: event.user.id,
          role: event.user.role,
        };
      }
      // Remove sensitive data from contexts
      if (event.contexts) {
        delete event.contexts.auth;
      }
      return event;
    },
  });
}

export { Sentry };
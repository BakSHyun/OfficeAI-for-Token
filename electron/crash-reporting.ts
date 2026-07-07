import * as Sentry from "@sentry/electron/main";

let initialized = false;

export function initCrashReporting(options: {
  enabled: boolean;
  dsn?: string;
  release: string;
}) {
  if (initialized || !options.enabled || !options.dsn) return;
  Sentry.init({
    dsn: options.dsn,
    release: options.release,
    environment: process.env.NODE_ENV === "development" ? "development" : "production",
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
      }
      return event;
    },
  });
  initialized = true;
}

export function captureMainException(error: unknown) {
  if (!initialized) return;
  Sentry.captureException(error);
}

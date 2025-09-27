import { Transport, LogRecord } from '../types';
import * as Sentry from '@sentry/react-native';

/**
 * Creates a Sentry transport that forwards logs to Sentry. Warnings, errors and
 * fatal logs are sent as Sentry breadcrumbs and errors/fatals are also
 * captured as messages. Lower severity logs become breadcrumbs only.
 * @returns A Transport instance for Sentry logging
 */
export function SentryTransport(): Transport {
  return {
    name: 'sentry',
    write(batch: LogRecord[]): void {
      try {
        for (const rec of batch) {
          const data = {
            ...rec.ctx,
            correlationId: rec.correlationId,
            ns: rec.ns,
            device: rec.device
          } as any;
          // Add a breadcrumb for all records
          Sentry.addBreadcrumb({
            category: rec.ns ?? 'log',
            message: rec.msg,
            level: rec.level as any,
            data
          });
          if (rec.level === 'error' || rec.level === 'fatal') {
            Sentry.captureMessage(rec.msg, {
              level: rec.level === 'fatal' ? 'fatal' : 'error',
              extra: data
            });
          }
        }
      } catch (err) {
        // silently ignore Sentry errors
      }
    },
    async flush(): Promise<void> {
      try {
        // flush with a timeout of 2 seconds
        await Sentry.flush(2000);
      } catch (err) {
        // ignore flush errors
      }
    }
  };
}
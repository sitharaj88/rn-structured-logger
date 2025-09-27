import { Transport, LogRecord } from '../types';

/**
 * A transport that writes logs to the JavaScript console. It formats each
 * record with an ISO date, namespace and uppercase level. Depending on
 * severity it uses console.debug/info for lower levels and console.warn/error
 * for higher levels.
 */
export const ConsoleTransport: Transport = {
  name: 'console',
  write(batch: LogRecord[]): void {
    for (const rec of batch) {
      const timestamp = new Date(rec.ts).toISOString();
      const prefix = `[${timestamp}] ${rec.ns ?? '-'} ${rec.level.toUpperCase()}:`;
      const payload = rec.ctx ? { ...rec.ctx, correlationId: rec.correlationId, device: rec.device } : { correlationId: rec.correlationId, device: rec.device };
      if (rec.level === 'error' || rec.level === 'fatal') {
        console.error(prefix, rec.msg, payload);
      } else if (rec.level === 'warn') {
        console.warn(prefix, rec.msg, payload);
      } else if (rec.level === 'info') {
        console.info(prefix, rec.msg, payload);
      } else {
        console.debug(prefix, rec.msg, payload);
      }
    }
  }
};
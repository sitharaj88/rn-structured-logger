import { Transport, LogRecord } from '../types';

/**
 * Console Transport - Writes structured logs to the JavaScript console.
 *
 * This transport formats each log record with:
 * - ISO timestamp: `2024-01-15T10:30:45.123Z`
 * - Namespace: The logger namespace (e.g., 'auth:login')
 * - Level: Uppercase severity level (TRACE, DEBUG, INFO, WARN, ERROR, FATAL)
 * - Message: The log message
 * - Context: Additional structured data
 *
 * Uses appropriate console methods based on severity:
 * - `console.debug()` for trace/debug levels
 * - `console.info()` for info level
 * - `console.warn()` for warn level
 * - `console.error()` for error/fatal levels
 *
 * @example
 * ```typescript
 * import { initLogger, ConsoleTransport } from 'rn-structured-logger';
 *
 * initLogger({
 *   level: 'debug',
 *   transports: [ConsoleTransport]
 * });
 *
 * // Console output will look like:
 * // [2024-01-15T10:30:45.123Z] app INFO: Application started { correlationId: "req-123" }
 * // [2024-01-15T10:30:45.124Z] auth:login DEBUG: Attempting login { username: "user@example.com" }
 * ```
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
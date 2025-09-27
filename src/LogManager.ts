import { Logger } from './Logger';
import { LoggerConfig } from './types';

// internal singleton instance
let instance: Logger | null = null;

/**
 * Initializes the global logger instance with the provided configuration.
 *
 * This function must be called once at application startup before using any
 * logging functions. It creates a singleton logger instance that can be
 * accessed via `getLogger()`.
 *
 * @param cfg - The logger configuration object
 * @returns The initialized logger instance for method chaining
 *
 * @throws Will throw an error if called multiple times
 *
 * @example
 * ```typescript
 * import { initLogger, ConsoleTransport, FileTransport } from 'rn-structured-logger';
 *
 * // Basic setup for development
 * initLogger({
 *   level: 'debug',
 *   transports: [ConsoleTransport]
 * });
 *
 * // Production setup with file logging and Sentry
 * initLogger({
 *   level: 'info',
 *   transports: [
 *     ConsoleTransport,
 *     FileTransport({ fileName: 'app.log', maxBytes: 1024 * 1024 }),
 *     SentryTransport()
 *   ],
 *   redactor: makeRedactor(['password', 'token', 'email']),
 *   sampling: { rate: 0.1 },
 *   rateLimit: { maxPerMin: 300 }
 * });
 * ```
 */
export function initLogger(cfg: LoggerConfig): Logger {
  instance = new Logger(cfg);
  return instance;
}

/**
 * Returns the global logger instance or creates a namespaced child logger.
 *
 * This function provides access to the singleton logger instance created by
 * `initLogger()`. You can optionally specify a namespace to create a child
 * logger with that namespace.
 *
 * @param namespace - Optional namespace for creating a child logger
 * @returns The global logger instance or a namespaced child logger
 *
 * @throws Error if `initLogger()` has not been called first
 *
 * @example
 * ```typescript
 * import { getLogger } from 'rn-structured-logger';
 *
 * // Get the root logger
 * const rootLogger = getLogger();
 *
 * // Get namespaced loggers
 * const authLogger = getLogger('auth');
 * const apiLogger = getLogger('api');
 * const userLogger = getLogger('user:profile');
 *
 * // All loggers share the same configuration but have different namespaces
 * rootLogger.info('Application started');
 * authLogger.info('User logged in', { userId: 123 });
 * apiLogger.debug('API request', { method: 'GET', path: '/users' });
 * ```
 */
export function getLogger(namespace?: string): Logger {
  if (!instance) {
    throw new Error('Logger not initialised. Call initLogger() first.');
  }
  return namespace ? instance.child(namespace) : instance;
}
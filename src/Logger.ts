import { LogLevel, LogRecord, LoggerConfig, Transport } from './types';
import { AsyncBatchQueue } from './utils/queue';
import { shouldSample } from './utils/sampler';
import { makeRateLimiter } from './utils/rateLimiter';

// ordered from most verbose to most severe
const LEVELS: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

/**
 * Enterprise-grade logger for React Native and Expo applications.
 *
 * The Logger class provides structured logging with features like:
 * - Multiple log levels (trace, debug, info, warn, error, fatal)
 * - Namespaced child loggers for organized logging
 * - Automatic batching and asynchronous flushing
 * - Built-in redaction for sensitive data
 * - Rate limiting and sampling
 * - Pluggable transport system
 * - Correlation ID tracking
 * - Console patching for third-party library compatibility
 *
 * @example
 * ```typescript
 * import { initLogger, getLogger, ConsoleTransport } from 'rn-structured-logger';
 *
 * // Initialize the logger
 * initLogger({
 *   level: 'info',
 *   transports: [ConsoleTransport]
 * });
 *
 * // Get a logger instance
 * const logger = getLogger('app');
 *
 * // Log messages with different levels
 * logger.info('Application started successfully');
 * logger.debug('Processing user request', { userId: 123, action: 'login' });
 * logger.error('Failed to connect to database', { error: 'Connection timeout' });
 *
 * // Create namespaced loggers
 * const authLogger = getLogger('auth');
 * const apiLogger = getLogger('api');
 *
 * authLogger.info('User authentication successful');
 * apiLogger.debug('API request completed', { endpoint: '/users', status: 200 });
 * ```
 */
export class Logger {
  private cfg: LoggerConfig;
  private rateLimiter?: () => boolean;
  private queue: AsyncBatchQueue<LogRecord>;

  /**
   * Creates a new logger instance with the given configuration.
   *
   * @param cfg - The logger configuration object
   *
   * @example
   * ```typescript
   * const logger = new Logger({
   *   level: 'debug',
   *   transports: [ConsoleTransport],
   *   namespace: 'myapp'
   * });
   * ```
   */
  constructor(cfg: LoggerConfig) {
    this.cfg = { ...cfg };
    if (cfg.rateLimit) {
      this.rateLimiter = makeRateLimiter(cfg.rateLimit.maxPerMin);
    }
    const batchSize = cfg.batch?.size ?? 20;
    const interval = cfg.batch?.intervalMs ?? 1500;
    this.queue = new AsyncBatchQueue<LogRecord>(batchSize, interval, async items => {
      // send the same batch to all transports
      await Promise.all(cfg.transports.map(t => {
        const result = t.write(items);
        return result instanceof Promise ? result : Promise.resolve(result);
      }));
    });
    if (cfg.patchConsole) {
      this.patchConsole();
    }
  }

  /**
   * Creates a child logger with an appended namespace.
   *
   * Child loggers inherit all configuration from their parent but have
   * a more specific namespace for better log organization.
   *
   * @param namespace - The namespace to append (e.g., 'auth', 'api', 'ui')
   * @returns A new Logger instance with the combined namespace
   *
   * @example
   * ```typescript
   * const rootLogger = getLogger('app');
   * const authLogger = rootLogger.child('auth');
   * const loginLogger = authLogger.child('login');
   *
   * // Logs will have namespaces: 'app', 'app:auth', 'app:auth:login'
   * rootLogger.info('App started');
   * authLogger.info('Auth module initialized');
   * loginLogger.info('Login attempt', { username: 'user@example.com' });
   * ```
   */
  child(namespace: string): Logger {
    const ns = this.cfg.namespace ? `${this.cfg.namespace}:${namespace}` : namespace;
    return new Logger({ ...this.cfg, namespace: ns });
  }

  /**
   * Sets the minimum log level at runtime.
   * @param level - The new minimum log level
   */
  setLevel(level: LogLevel): void {
    this.cfg.level = level;
  }

  /**
   * Sets or clears the correlation ID used for all subsequent log records.
   *
   * Correlation IDs help track related log entries across different parts
   * of your application, making debugging distributed operations easier.
   *
   * @param id - The correlation ID, or undefined to clear the current ID
   *
   * @example
   * ```typescript
   * const logger = getLogger('api');
   *
   * // Set correlation ID for a request
   * logger.setCorrelationId('req-12345');
   *
   * logger.info('Processing API request', { method: 'POST', path: '/users' });
   * // This log will include correlationId: 'req-12345'
   *
   * // Clear correlation ID when request is done
   * logger.setCorrelationId(undefined);
   * ```
   */
  setCorrelationId(id?: string): void {
    this.cfg.correlationId = id;
  }

  /**
   * Determines whether a log level passes the configured threshold.
   * @param level - The log level to check
   * @returns True if the level should be logged
   */
  private allowed(level: LogLevel): boolean {
    return LEVELS.indexOf(level) >= LEVELS.indexOf(this.cfg.level);
  }

  /**
   * Constructs a log record from a message and optional context.
   * @param level - The severity level
   * @param msg - The log message
   * @param ctx - Optional context data
   * @returns The constructed LogRecord
   */
  private buildRecord(level: LogLevel, msg: string, ctx?: Record<string, unknown>): LogRecord {
    return {
      ts: Date.now(),
      level,
      msg,
      ns: this.cfg.namespace,
      ctx,
      correlationId: this.cfg.correlationId,
      device: this.cfg.device
    };
  }

  /**
   * Processes a record: redacts sensitive data, applies sampling/rate limiting and queues it.
   * @param record - The log record to process
   */
  private process(record: LogRecord): void {
    // apply redaction
    if (this.cfg.redactor) {
      record = this.cfg.redactor(record);
    }
    // rate limit
    if (this.rateLimiter && !this.rateLimiter()) {
      return;
    }
    // sampling
    const rate = this.cfg.sampling?.rate ?? 1;
    if (!shouldSample(record.level, rate)) {
      return;
    }
    this.queue.push(record);
  }

  /**
   * Logs a trace message.
   * @param msg - The log message
   * @param ctx - Optional context data
   */
  trace(msg: string, ctx?: Record<string, unknown>): void {
    if (this.allowed('trace')) this.process(this.buildRecord('trace', msg, ctx));
  }

  /**
   * Logs a debug message.
   * @param msg - The log message
   * @param ctx - Optional context data
   */
  debug(msg: string, ctx?: Record<string, unknown>): void {
    if (this.allowed('debug')) this.process(this.buildRecord('debug', msg, ctx));
  }

  /**
   * Logs an info message.
   *
   * Info messages are for general information about application operation.
   * Use this level for important events that are not errors but should be
   * visible in production logs.
   *
   * @param msg - The log message
   * @param ctx - Optional context data to include with the log record
   *
   * @example
   * ```typescript
   * const logger = getLogger('user');
   *
   * // Simple info message
   * logger.info('User profile updated successfully');
   *
   * // Info with context
   * logger.info('Payment processed', {
   *   userId: 12345,
   *   amount: 99.99,
   *   currency: 'USD',
   *   transactionId: 'txn_abc123'
   * });
   * ```
   */
  info(msg: string, ctx?: Record<string, unknown>): void {
    if (this.allowed('info')) this.process(this.buildRecord('info', msg, ctx));
  }

  /**
   * Logs a warning message.
   * @param msg - The log message
   * @param ctx - Optional context data
   */
  warn(msg: string, ctx?: Record<string, unknown>): void {
    if (this.allowed('warn')) this.process(this.buildRecord('warn', msg, ctx));
  }

  /**
   * Logs an error message.
   *
   * Error messages indicate problems that should be investigated.
   * These are always logged regardless of sampling settings.
   *
   * @param msg - The log message describing the error
   * @param ctx - Optional context data including error details
   *
   * @example
   * ```typescript
   * const logger = getLogger('api');
   *
   * try {
   *   await processPayment(paymentData);
   *   logger.info('Payment processed successfully');
   * } catch (error) {
   *   logger.error('Payment processing failed', {
   *     error: error.message,
   *     userId: paymentData.userId,
   *     amount: paymentData.amount,
   *     stack: error.stack
   *   });
   * }
   * ```
   */
  error(msg: string, ctx?: Record<string, unknown>): void {
    if (this.allowed('error')) this.process(this.buildRecord('error', msg, ctx));
  }

  /**
   * Logs a fatal message.
   * @param msg - The log message
   * @param ctx - Optional context data
   */
  fatal(msg: string, ctx?: Record<string, unknown>): void {
    if (this.allowed('fatal')) this.process(this.buildRecord('fatal', msg, ctx));
  }

  /**
   * Flushes queued records and underlying transports.
   *
   * This method ensures all pending log records are written to their
   * destinations before continuing. Useful before app shutdown or
   * when you need to ensure logs are persisted.
   *
   * @returns A promise that resolves when all flushing is complete
   *
   * @example
   * ```typescript
   * const logger = getLogger();
   *
   * // Log some messages
   * logger.info('Starting cleanup process');
   * await performCleanup();
   * logger.info('Cleanup completed');
   *
   * // Ensure all logs are written before exit
   * await logger.flush();
   * process.exit(0);
   * ```
   */
  async flush(): Promise<void> {
    await this.queue.flush();
    await Promise.all(this.cfg.transports.map(t => t.flush ? t.flush() : Promise.resolve()));
  }

  /**
   * Flushes and disposes of transports. After calling this the logger should not be used.
   *
   * This method should be called when shutting down the application to ensure
   * all logs are written and resources are properly cleaned up.
   *
   * @returns A promise that resolves when disposal is complete
   *
   * @example
   * ```typescript
   * const logger = getLogger();
   *
   * // Application shutdown
   * process.on('SIGTERM', async () => {
   *   logger.info('Shutting down gracefully');
   *
   *   // Flush and dispose of all transports
   *   await logger.dispose();
   *
   *   process.exit(0);
   * });
   * ```
   */
  async dispose(): Promise<void> {
    await this.flush();
    await Promise.all(this.cfg.transports.map(t => t.dispose ? t.dispose() : Promise.resolve()));
  }

  /**
   * Overrides console logging functions with logger methods. Only executed once during construction if `patchConsole` is true.
   */
  private patchConsole(): void {
    // preserve other console methods (time, table, etc.)
    const original = { ...console };
    const self = this;
    console.log = (...args: unknown[]) => {
      self.debug(args.map(String).join(' '));
    };
    console.info = (...args: unknown[]) => {
      self.info(args.map(String).join(' '));
    };
    console.warn = (...args: unknown[]) => {
      self.warn(args.map(String).join(' '));
    };
    console.error = (...args: unknown[]) => {
      self.error(args.map(String).join(' '));
    };
    console.debug = (...args: unknown[]) => {
      self.debug(args.map(String).join(' '));
    };
    // keep other methods intact
    console.table = original.table?.bind(original) ?? console.table;
    console.time = original.time?.bind(original) ?? console.time;
    console.timeEnd = original.timeEnd?.bind(original) ?? console.timeEnd;
  }
}
import { LogLevel, LogRecord, LoggerConfig, Transport } from './types';
import { AsyncBatchQueue } from './utils/queue';
import { shouldSample } from './utils/sampler';
import { makeRateLimiter } from './utils/rateLimiter';

// ordered from most verbose to most severe
const LEVELS: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

/**
 * The core logger implementation. Instances of this class are created via
 * `initLogger()` and `Logger.child()`. See README.md for usage examples.
 */
export class Logger {
  private cfg: LoggerConfig;
  private rateLimiter?: () => boolean;
  private queue: AsyncBatchQueue<LogRecord>;

  /**
   * Creates a new logger instance with the given configuration.
   * @param cfg - The logger configuration
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
   * @param namespace - The namespace to append (e.g., 'auth')
   * @returns A new Logger instance with the combined namespace
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
   * @param id - The correlation ID, or undefined to clear
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
   * @param msg - The log message
   * @param ctx - Optional context data
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
   * @param msg - The log message
   * @param ctx - Optional context data
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
   * @returns A promise that resolves when all flushing is complete
   */
  async flush(): Promise<void> {
    await this.queue.flush();
    await Promise.all(this.cfg.transports.map(t => t.flush ? t.flush() : Promise.resolve()));
  }

  /**
   * Flushes and disposes of transports. After calling this the logger should not be used.
   * @returns A promise that resolves when disposal is complete
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
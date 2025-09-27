/**
 * Defines the severity levels supported by the logger.  Lower values are more verbose.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Structure of a log record.  All fields except `ts`, `level` and `msg` are optional.
 */
export interface LogRecord {
  /** Milliseconds since Unix epoch */
  ts: number;
  /** Severity level */
  level: LogLevel;
  /** Log message */
  msg: string;
  /** Optional namespace (usually `parent:child`) */
  ns?: string;
  /** Arbitrary context information serialized into the record */
  ctx?: Record<string, unknown>;
  /** Correlation ID used to tie logs belonging to the same request or session */
  correlationId?: string;
  /** Static device/app information or additional metadata */
  device?: Record<string, unknown>;
}

/**
 * Interface implemented by every transport.  A transport is responsible for handling
 * log records (e.g. writing them to disk, sending to a server, etc.).  It receives
 * batches of records to minimize overhead.
 */
export interface Transport {
  /** Unique name for the transport */
  name: string;
  /**
   * Write a batch of log records.  May return a promise if asynchronous.
   */
  write(batch: LogRecord[]): void | Promise<void>;
  /**
   * Flush any buffered writes.  Optional.
   */
  flush?(): Promise<void>;
  /**
   * Dispose the transport, releasing any resources.  Optional.
   */
  dispose?(): Promise<void>;
}

/**
 * A function that receives a log record and returns a new record with sensitive
 * values removed or masked.  Used for redaction.
 */
export type Redactor = (record: LogRecord) => LogRecord;

/**
 * Configuration passed to `initLogger`.  See README.md for details.
 */
export interface LoggerConfig {
  /** Minimum severity to record.  Lower levels are ignored. */
  level: LogLevel;
  /** Transports that handle log records.  At least one transport is required. */
  transports: Transport[];
  /** Optional namespace to apply to all logs from this logger instance. */
  namespace?: string;
  /** Redactor used to remove or mask sensitive data from logs */
  redactor?: Redactor;
  /** Sampling strategy.  Non‑error/fatal logs are recorded at the given rate (0..1). */
  sampling?: { rate: number };
  /** Rate limit configuration.  Maximum number of logs per minute. */
  rateLimit?: { maxPerMin: number };
  /** Batching configuration.  Batch size and interval in milliseconds. */
  batch?: { size: number; intervalMs: number };
  /** Correlation ID applied to all records until changed */
  correlationId?: string;
  /** Static device/application metadata applied to all records */
  device?: Record<string, unknown>;
  /** If true, will replace console.log/info/warn/error with logger methods */
  patchConsole?: boolean;
}
import { Logger } from './Logger';
import { LoggerConfig } from './types';

// internal singleton instance
let instance: Logger | null = null;

/**
 * Creates the global logger instance. Must be called before using getLogger().
 * Returns the created logger for chaining.
 * @param cfg - The logger configuration
 * @returns The initialized logger instance
 */
export function initLogger(cfg: LoggerConfig): Logger {
  instance = new Logger(cfg);
  return instance;
}

/**
 * Returns the global logger or a child logger with the given namespace. Throws
 * if initLogger() has not been called. Use an empty string to get the root.
 * @param namespace - Optional namespace for a child logger
 * @returns The logger instance
 * @throws Error if logger not initialized
 */
export function getLogger(namespace?: string): Logger {
  if (!instance) {
    throw new Error('Logger not initialised. Call initLogger() first.');
  }
  return namespace ? instance.child(namespace) : instance;
}
import { LogLevel } from '../types';

/**
 * Determines whether a log should be sampled based on its level and a sampling rate.
 * Error, fatal and warn logs bypass sampling and are always kept. Other levels
 * are kept with probability equal to `rate` (between 0 and 1). Use this to reduce
 * the volume of debug or info logs in production.
 * @param level - The log level
 * @param rate - Sampling rate (0 to 1), defaults to 1
 * @returns True if the log should be kept
 */
export function shouldSample(level: LogLevel, rate = 1): boolean {
  // Always keep warnings, errors and fatals
  if (level === 'error' || level === 'fatal' || level === 'warn') {
    return true;
  }
  return Math.random() < rate;
}
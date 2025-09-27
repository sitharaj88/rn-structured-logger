import { LogRecord, Redactor } from '../types';

/**
 * Default keys that should never be logged in plain text. Keys are lowercased before
 * comparison, so you can pass them in any case.
 */
const DEFAULT_SENSITIVE_KEYS = [
  'password', 'pass', 'token', 'authorization', 'secret', 'otp', 'pin', 'creditcard', 'sessionid'
];

/**
 * Creates a redactor function. The returned function traverses the `ctx` object
 * recursively and replaces values of sensitive keys with `[REDACTED]`. Extra keys
 * passed as arguments are merged with the built‑in list.
 * @param extraKeys - Additional keys to redact
 * @returns A redactor function
 */
export function makeRedactor(extraKeys: string[] = []): Redactor {
  const keys = new Set(
    [...DEFAULT_SENSITIVE_KEYS, ...extraKeys].map(k => k.toLowerCase())
  );
  const redactValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(redactValue);
    }
    if (value && typeof value === 'object') {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        obj[k] = keys.has(k.toLowerCase()) ? '[REDACTED]' : redactValue(v);
      }
      return obj;
    }
    return value;
  };
  return (record: LogRecord): LogRecord => {
    if (!record.ctx) return record;
    return {
      ...record,
      ctx: redactValue(record.ctx) as Record<string, unknown>
    };
  };
}
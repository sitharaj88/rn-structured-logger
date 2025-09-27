import { AsyncBatchQueue } from '../src/utils/queue';
import { makeRateLimiter } from '../src/utils/rateLimiter';
import { makeRedactor } from '../src/utils/redactor';
import { shouldSample } from '../src/utils/sampler';
import { LogRecord } from '../src/types';

describe('AsyncBatchQueue', () => {
  let flushFn: jest.Mock;
  let queue: AsyncBatchQueue<number>;

  beforeEach(() => {
    flushFn = jest.fn().mockResolvedValue(undefined);
    queue = new AsyncBatchQueue(2, 100, flushFn);
  });

  test('flushes when batch size reached', async () => {
    queue.push(1);
    queue.push(2);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(flushFn).toHaveBeenCalledWith([1, 2]);
  });

  test('flushes on interval', async () => {
    queue.push(1);
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(flushFn).toHaveBeenCalledWith([1]);
  });

  test('manual flush', async () => {
    queue.push(1);
    await queue.flush();
    expect(flushFn).toHaveBeenCalledWith([1]);
  });
});

describe('makeRateLimiter', () => {
  test('allows up to max per minute', () => {
    const limiter = makeRateLimiter(2);
    expect(limiter()).toBe(true);
    expect(limiter()).toBe(true);
    expect(limiter()).toBe(false);
  });
});

describe('makeRedactor', () => {
  test('redacts default sensitive keys', () => {
    const redactor = makeRedactor();
    const record: LogRecord = {
      ts: 0,
      level: 'info',
      msg: 'test',
      ctx: { password: 'secret', normal: 'value' },
    };
    const redacted = redactor(record);
    expect(redacted.ctx?.password).toBe('[REDACTED]');
    expect(redacted.ctx?.normal).toBe('value');
  });

  test('redacts extra keys', () => {
    const redactor = makeRedactor(['custom']);
    const record: LogRecord = {
      ts: 0,
      level: 'info',
      msg: 'test',
      ctx: { custom: 'secret' },
    };
    const redacted = redactor(record);
    expect(redacted.ctx?.custom).toBe('[REDACTED]');
  });

  test('handles nested objects', () => {
    const redactor = makeRedactor();
    const record: LogRecord = {
      ts: 0,
      level: 'info',
      msg: 'test',
      ctx: { user: { password: 'secret' } },
    };
    const redacted = redactor(record);
    expect((redacted.ctx?.user as any).password).toBe('[REDACTED]');
  });
});

describe('shouldSample', () => {
  test('always samples error/fatal/warn', () => {
    expect(shouldSample('error', 0)).toBe(true);
    expect(shouldSample('fatal', 0)).toBe(true);
    expect(shouldSample('warn', 0)).toBe(true);
  });

  test('samples based on rate for other levels', () => {
    // Mock Math.random to return 0.5
    const originalRandom = Math.random;
    Math.random = jest.fn(() => 0.5);
    expect(shouldSample('info', 0.6)).toBe(true);
    expect(shouldSample('info', 0.4)).toBe(false);
    Math.random = originalRandom;
  });
});
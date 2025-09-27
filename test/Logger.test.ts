import { Logger } from '../src/Logger';
import { LogRecord, Transport } from '../src/types';

// Mock transport to capture written records
class MockTransport implements Transport {
  name = 'mock';
  written: LogRecord[][] = [];

  write(batch: LogRecord[]): void {
    this.written.push(batch);
  }

  flush?(): Promise<void> {
    return Promise.resolve();
  }

  dispose?(): Promise<void> {
    return Promise.resolve();
  }
}

describe('Logger', () => {
  let mockTransport: MockTransport;
  let logger: Logger;

  beforeEach(() => {
    mockTransport = new MockTransport();
    logger = new Logger({
      level: 'debug',
      transports: [mockTransport],
      batch: { size: 1, intervalMs: 0 }, // Immediate flush for testing
    });
  });

  afterEach(async () => {
    await logger.dispose();
  });

  test('logs at allowed level', () => {
    logger.info('test message', { key: 'value' });
    expect(mockTransport.written.length).toBe(1);
    const record = mockTransport.written[0][0];
    expect(record.level).toBe('info');
    expect(record.msg).toBe('test message');
    expect(record.ctx).toEqual({ key: 'value' });
  });

  test('does not log below threshold', () => {
    logger = new Logger({
      level: 'warn',
      transports: [mockTransport],
      batch: { size: 1, intervalMs: 0 },
    });
    logger.info('should not log');
    expect(mockTransport.written.length).toBe(0);
  });

  test('creates child logger with namespace', () => {
    const child = logger.child('child');
    child.info('child message');
    const record = mockTransport.written[0][0];
    expect(record.ns).toBe('child');
  });

  test('sets correlation ID', () => {
    logger.setCorrelationId('test-id');
    logger.info('message');
    const record = mockTransport.written[0][0];
    expect(record.correlationId).toBe('test-id');
  });

  test('sets level at runtime', () => {
    logger.setLevel('error');
    logger.info('should not log');
    expect(mockTransport.written.length).toBe(0);
    logger.error('should log');
    expect(mockTransport.written.length).toBe(1);
  });

  test('flushes records', async () => {
    logger.info('message');
    await logger.flush();
    // Since batch size is 1, it should have flushed
    expect(mockTransport.written.length).toBe(1);
  });
});
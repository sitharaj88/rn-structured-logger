import { ConsoleTransport } from '../src/transports/ConsoleTransport';
import { FileTransport } from '../src/transports/FileTransport';
import { HttpTransport } from '../src/transports/HttpTransport';
import { SentryTransport } from '../src/transports/SentryTransport';
import { LogRecord } from '../src/types';

// Mock react-native-fs
jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  stat: jest.fn(),
  moveFile: jest.fn(),
  appendFile: jest.fn(),
}));

// Mock @sentry/react-native
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  flush: jest.fn(),
}));

// Mock console
const mockConsole = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
global.console = mockConsole as any;

describe('ConsoleTransport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('writes to console with correct level', () => {
    const record: LogRecord = {
      ts: Date.now(),
      level: 'info',
      msg: 'test message',
      ctx: { key: 'value' },
      correlationId: 'id',
      device: { os: 'ios' },
    };
    ConsoleTransport.write([record]);
    expect(mockConsole.info).toHaveBeenCalledWith(
      expect.stringContaining('INFO:'),
      'test message',
      expect.objectContaining({ key: 'value', correlationId: 'id', device: { os: 'ios' } })
    );
  });

  test('uses error for error level', () => {
    const record: LogRecord = { ts: Date.now(), level: 'error', msg: 'error msg' };
    ConsoleTransport.write([record]);
    expect(mockConsole.error).toHaveBeenCalled();
  });
});

describe('FileTransport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('appends to file', async () => {
    const mockRNFS = require('react-native-fs');
    mockRNFS.stat.mockResolvedValue({ isFile: () => true, size: 100 });
    const transport = FileTransport({ fileName: 'test.log' });
    const record: LogRecord = { ts: Date.now(), level: 'info', msg: 'test' };
    await transport.write([record]);
    expect(mockRNFS.appendFile).toHaveBeenCalledWith('/cache/test.log', expect.stringContaining('"msg":"test"'), 'utf8');
  });

  test('ignores file write errors', async () => {
    const mockRNFS = require('react-native-fs');
    mockRNFS.stat.mockResolvedValue({ isFile: () => true, size: 100 });
    mockRNFS.appendFile.mockRejectedValue(new Error('disk full'));
    const transport = FileTransport({ fileName: 'test.log' });
    const record: LogRecord = { ts: Date.now(), level: 'info', msg: 'test' };
    await expect(transport.write([record])).resolves.toBeUndefined();
  });
});

describe('HttpTransport', () => {
  const mockFetch = jest.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('posts to url', async () => {
    mockFetch.mockResolvedValue({});
    const transport = HttpTransport({ url: 'http://example.com/logs' });
    const record: LogRecord = { ts: Date.now(), level: 'info', msg: 'test' };
    await transport.write([record]);
    expect(mockFetch).toHaveBeenCalledWith('http://example.com/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([record]),
    });
  });

  test('ignores fetch errors', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));
    const transport = HttpTransport({ url: 'http://example.com/logs' });
    await expect(transport.write([{ ts: Date.now(), level: 'info', msg: 'test' }])).resolves.toBeUndefined();
  });
});

describe('SentryTransport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('adds breadcrumb for all levels', () => {
    const mockSentry = require('@sentry/react-native');
    const transport = SentryTransport();
    const record: LogRecord = { ts: Date.now(), level: 'info', msg: 'test', ns: 'ns' };
    transport.write([record]);
    expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'ns',
      message: 'test',
      level: 'info',
      data: expect.objectContaining({ ns: 'ns' }),
    });
  });

  test('captures message for error', () => {
    const mockSentry = require('@sentry/react-native');
    const transport = SentryTransport();
    const record: LogRecord = { ts: Date.now(), level: 'error', msg: 'error' };
    transport.write([record]);
    expect(mockSentry.captureMessage).toHaveBeenCalledWith('error', {
      level: 'error',
      extra: expect.any(Object),
    });
  });

  test('ignores Sentry errors', () => {
    const mockSentry = require('@sentry/react-native');
    mockSentry.addBreadcrumb.mockImplementation(() => { throw new Error('Sentry error'); });
    const transport = SentryTransport();
    const record: LogRecord = { ts: Date.now(), level: 'info', msg: 'test' };
    expect(() => transport.write([record])).not.toThrow();
  });

  test('flushes sentry', async () => {
    const mockSentry = require('@sentry/react-native');
    mockSentry.flush.mockResolvedValue(true);
    const transport = SentryTransport();
    if (transport.flush) {
      await transport.flush();
      expect(mockSentry.flush).toHaveBeenCalledWith(2000);
    }
  });
});
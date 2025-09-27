---
sidebar_label: API Reference
---

# API Reference

This section contains the complete API reference for RN Structured Logger, automatically generated from the TypeScript source code.

## Core Functions

### `initLogger(config: LoggerConfig): Logger`

Initializes the global logger instance with the provided configuration.

**Parameters:**
- `config` - The logger configuration object

**Returns:** The initialized logger instance

**Example:**
```typescript
import { initLogger, ConsoleTransport } from 'rn-structured-logger';

const logger = initLogger({
  level: 'info',
  transports: [ConsoleTransport]
});
```

### `getLogger(namespace?: string): Logger`

Returns the global logger instance or creates a namespaced child logger.

**Parameters:**
- `namespace` - Optional namespace for creating a child logger

**Returns:** The global logger instance or a namespaced child logger

**Example:**
```typescript
const rootLogger = getLogger();
const apiLogger = getLogger('api');
const authLogger = getLogger('auth:login');
```

## Logger Class

### Constructor

```typescript
new Logger(config: LoggerConfig)
```

Creates a new logger instance with the given configuration.

### Methods

#### Logging Methods

##### `trace(message: string, context?: object): void`

Logs a trace message (most verbose level).

##### `debug(message: string, context?: object): void`

Logs a debug message for development purposes.

##### `info(message: string, context?: object): void`

Logs an info message for general application information.

##### `warn(message: string, context?: object): void`

Logs a warning message for potential issues.

##### `error(message: string, context?: object): void`

Logs an error message for problems that occurred.

##### `fatal(message: string, context?: object): void`

Logs a fatal message for critical errors.

#### Configuration Methods

##### `setLevel(level: LogLevel): void`

Sets the minimum log level at runtime.

**Parameters:**
- `level` - The new minimum log level ('trace', 'debug', 'info', 'warn', 'error', 'fatal')

##### `setCorrelationId(id?: string): void`

Sets or clears the correlation ID for all subsequent log records.

**Parameters:**
- `id` - The correlation ID, or undefined to clear

#### Lifecycle Methods

##### `flush(): Promise<void>`

Flushes queued records and underlying transports.

**Returns:** Promise that resolves when all flushing is complete

##### `dispose(): Promise<void>`

Flushes and disposes of transports. The logger should not be used after calling this.

**Returns:** Promise that resolves when disposal is complete

##### `child(namespace: string): Logger`

Creates a child logger with an appended namespace.

**Parameters:**
- `namespace` - The namespace to append

**Returns:** A new Logger instance with the combined namespace

## Configuration Types

### `LoggerConfig`

```typescript
interface LoggerConfig {
  level?: LogLevel;
  transports?: Transport[];
  redactor?: Redactor;
  sampling?: { rate: number };
  rateLimit?: { maxPerMin: number };
  batch?: { size: number; intervalMs: number };
  device?: Record<string, unknown>;
  patchConsole?: boolean;
}
```

### `LogLevel`

```typescript
type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
```

### `LogRecord`

```typescript
interface LogRecord {
  ts: number;           // Timestamp (Unix epoch in milliseconds)
  level: LogLevel;      // Log severity level
  msg: string;          // Log message
  ns?: string;          // Namespace
  ctx?: object;         // Additional context data
  correlationId?: string; // Correlation ID for tracking
  device?: object;      // Device information
}
```

### `Transport`

```typescript
interface Transport {
  name: string;
  write(records: LogRecord[]): void | Promise<void>;
  flush?(): void | Promise<void>;
  dispose?(): void | Promise<void>;
}
```

## Transport Classes

### `ConsoleTransport`

Writes structured logs to the JavaScript console with formatted timestamps and levels.

**Usage:**
```typescript
import { ConsoleTransport } from 'rn-structured-logger';

initLogger({
  transports: [ConsoleTransport]
});
```

### `FileTransport(options: FileTransportOptions)`

Writes logs to the local filesystem with automatic rotation.

**Parameters:**
```typescript
interface FileTransportOptions {
  fileName: string;    // Name of the log file
  maxBytes?: number;   // Maximum file size before rotation (default: 524288 bytes)
}
```

**Usage:**
```typescript
import { FileTransport } from 'rn-structured-logger';

initLogger({
  transports: [
    FileTransport({
      fileName: 'app.log',
      maxBytes: 1024 * 1024  // 1MB
    })
  ]
});
```

### `SentryTransport()`

Sends error and fatal logs to Sentry for monitoring and alerting.

**Usage:**
```typescript
import { SentryTransport } from 'rn-structured-logger';

initLogger({
  transports: [SentryTransport()]
});
```

### `HttpTransport(options: HttpTransportOptions)`

Sends logs to a custom HTTP endpoint.

**Parameters:**
```typescript
interface HttpTransportOptions {
  url: string;              // The endpoint URL
  headers?: Record<string, string>;  // Additional headers
  method?: string;          // HTTP method (default: 'POST')
}
```

**Usage:**
```typescript
import { HttpTransport } from 'rn-structured-logger';

initLogger({
  transports: [
    HttpTransport({
      url: 'https://your-logging-endpoint.com/logs',
      headers: { Authorization: 'Bearer your-token' }
    })
  ]
});
```

## Utility Functions

### `makeRedactor(keys: string[]): Redactor`

Creates a redactor function that masks sensitive data.

**Parameters:**
- `keys` - Array of property names to redact

**Returns:** A redactor function

**Example:**
```typescript
import { makeRedactor } from 'rn-structured-logger';

const redactor = makeRedactor(['password', 'token', 'email']);

logger.info('User data', {
  username: 'john_doe',
  password: 'secret123',  // Will be redacted to '[REDACTED]'
  email: 'john@example.com'  // Will be redacted
});
```

### `shouldSample(level: LogLevel, rate: number): boolean`

Determines whether a log record should be sampled based on the level and rate.

**Parameters:**
- `level` - The log level
- `rate` - Sampling rate between 0.0 and 1.0

**Returns:** True if the log should be included

### `makeRateLimiter(maxPerMin: number): () => boolean`

Creates a rate limiter that allows a maximum number of logs per minute.

**Parameters:**
- `maxPerMin` - Maximum number of logs allowed per minute

**Returns:** A function that returns true if logging is allowed

## Error Handling

The library throws the following errors:

- **`Error: Logger not initialised. Call initLogger() first.`**
  - Thrown when `getLogger()` is called before `initLogger()`

- **`Error: [Transport Error]`**
  - Thrown by transports when they encounter errors (e.g., file system errors, network failures)

## TypeScript Support

RN Structured Logger is written in TypeScript and provides full type safety:

- All configuration objects are strongly typed
- Log levels are constrained to valid values
- Transport interfaces ensure proper implementation
- Generic types for context objects

```typescript
// Fully type-safe usage
interface UserContext {
  userId: number;
  action: string;
  timestamp: string;
}

logger.info<UserContext>('User action performed', {
  userId: 123,
  action: 'login',
  timestamp: new Date().toISOString()
});
```
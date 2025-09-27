# RN Structured Logger

[![npm version](https://badge.fury.io/js/rn-structured-logger.svg)](https://badge.fury.io/js/rn-structured-logger)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

An enterprise-grade logging library for React Native, Expo, and cross-platform JavaScript applications. It provides structured logs, namespaces, context injection, batching, rate limiting, and redaction out of the box. Logs are batched and flushed asynchronously to reduce impact on the UI thread and can be persisted locally or forwarded to remote services such as Sentry.

## Table of Contents

- [Features](#features)
- [Platform Compatibility](#platform-compatibility)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Setup](#setup)
  - [Logging Events](#logging-events)
  - [Namespaces](#namespaces)
  - [Context and Correlation IDs](#context-and-correlation-ids)
  - [Redaction](#redaction)
  - [Rate Limiting and Sampling](#rate-limiting-and-sampling)
  - [Flushing and Disposing](#flushing-and-disposing)
- [Transports](#transports)
- [Configuration Options](#configuration-options)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Structured log records**: Each entry includes a timestamp, level, message, namespace, and arbitrary context.
- **Pluggable transports**: Send logs to the JavaScript console, persist them to the local filesystem (with rotation), or forward them to Sentry or your own HTTP endpoint. Multiple transports can run concurrently.
- **Namespaces (child loggers)**: Create scoped loggers (e.g., `auth:login`) to filter or group logs.
- **Context injection**: Attach correlation IDs, user identifiers, device metadata, or any other static information to every log record.
- **Redaction**: Mask sensitive properties (password, token, etc.) before they leave the device. You can specify additional keys to redact.
- **Rate limiting and sampling**: Protect your backend and devices by limiting the number of logs per minute and sampling non-error logs at configurable rates.
- **Batching and asynchronous flushing**: Logs are buffered and written in batches on a background queue, minimizing UI thread impact. You control the batch size and flush interval.
- **Conditional logging**: Dynamically adjust severity levels at runtime (e.g., verbose debugging in development, minimal logging in production).
- **Console patching (optional)**: Redirect `console.log`, `warn`, `error`, and `info` through your logger so all third-party libraries follow your policies.
- **TypeScript types**: First-class TypeScript support with strict typings.

## Platform Compatibility

This library is designed for cross-platform React Native and Expo applications:

- **iOS & Android**: Full functionality including file system logging via `react-native-fs`.
- **Web (Expo)**: Console logging with full structured logging features (timestamps, levels, context, redaction).
- **macOS & Windows**: Console logging only (file system access not supported).

The logger automatically adapts to the platform - on web, it uses only the ConsoleTransport, while on native platforms, it can include file logging.

## Installation

```sh
npm install rn-structured-logger
# or
yarn add rn-structured-logger
```

### Peer Dependencies

You must install the following peer dependencies if you intend to use the corresponding transports:

```sh
# For file logging on native platforms
npm install react-native-fs

# For Sentry integration
npm install @sentry/react-native

# For Expo device info (optional, for enhanced device context)
npm install expo-device
```

These are declared as peer dependencies so your project controls their versions.

## Quick Start

```typescript
import { initLogger, getLogger, ConsoleTransport } from 'rn-structured-logger';

// Initialize the logger
initLogger({
  level: 'info',
  transports: [ConsoleTransport],
});

// Get a logger and start logging
const logger = getLogger('app');
logger.info('App started successfully');
```

## Usage

### Setup

Initialize the logger once, typically during app bootstrap. Provide transports appropriate to your environment and inject static device information.

```typescript
import { initLogger, ConsoleTransport, FileTransport, SentryTransport, makeRedactor } from 'rn-structured-logger';
import * as Device from 'expo-device'; // or react-native-device-info

// Gather static device/app info
const device = {
  platform: Platform.OS,
  appVersion: '1.0.0',
  deviceModel: Device.modelName || 'unknown',
  osVersion: Device.osVersion || 'unknown',
};

initLogger({
  level: __DEV__ ? 'debug' : 'info',
  transports: __DEV__
    ? [ConsoleTransport]
    : [ConsoleTransport, FileTransport({ fileName: 'app.log', maxBytes: 1024 * 1024 }), SentryTransport()],
  redactor: makeRedactor(['password', 'token', 'email', 'phone']),
  sampling: { rate: __DEV__ ? 1 : 0.1 },
  rateLimit: { maxPerMin: 300 },
  batch: { size: 50, intervalMs: 2000 },
  device,
  patchConsole: true,
});
```

### Logging Events

Retrieve a logger via `getLogger()` and use its methods:

```typescript
import { getLogger } from 'rn-structured-logger';

const logger = getLogger('auth:login');

logger.debug('Attempting login', { username: 'alice@example.com' });

try {
  const result = await login(credentials);
  logger.info('Login successful', { userId: result.id });
} catch (error) {
  logger.error('Login failed', { error: error.message });
}
```

### Namespaces

Create scoped loggers for different parts of your application:

```typescript
const authLogger = getLogger('auth');
const apiLogger = getLogger('api');
const uiLogger = getLogger('ui');

authLogger.info('User authentication flow started');
apiLogger.debug('API request to /user/profile');
uiLogger.warn('UI component failed to render');
```

### Context and Correlation IDs

Attach context to all logs in a session or request:

```typescript
const logger = getLogger();

// Set correlation ID for an entire flow
logger.setCorrelationId('req-9b2c1d4e');

// All subsequent logs will include this correlation ID
logger.info('Processing request', { action: 'validate' });
```

### Redaction

Automatically mask sensitive data:

```typescript
const logger = getLogger();

logger.info('User registration', {
  username: 'john_doe',
  password: 'secret123', // Will be redacted to [REDACTED]
  email: 'john@example.com', // Will be redacted
  age: 25, // Not redacted
});
```

### Rate Limiting and Sampling

Control log volume:

```typescript
initLogger({
  // Sample 10% of non-error logs in production
  sampling: { rate: 0.1 },
  // Limit to 300 logs per minute
  rateLimit: { maxPerMin: 300 },
});
```

### Flushing and Disposing

Flush pending logs or clean up resources:

```typescript
import { getLogger } from 'rn-structured-logger';

const logger = getLogger();

// Flush queued records
await logger.flush();

// Flush and dispose transports (e.g., on app exit)
await logger.dispose();
```

## Transports

### ConsoleTransport

Writes logs to the console. The message includes an ISO date, namespace, and level.

```typescript
import { ConsoleTransport } from 'rn-structured-logger';

initLogger({
  transports: [ConsoleTransport],
});
```

### FileTransport

Writes logs to a file using `react-native-fs`. Supports rotation when the file exceeds a size threshold.

```typescript
import { FileTransport } from 'rn-structured-logger';

initLogger({
  transports: [
    FileTransport({
      fileName: 'app.log',
      maxBytes: 1024 * 1024, // 1MB
    }),
  ],
});
```

### SentryTransport

Sends error and fatal logs to Sentry.

```typescript
import { SentryTransport } from 'rn-structured-logger';

initLogger({
  transports: [SentryTransport()],
});
```

### HttpTransport

Sends logs to a custom HTTP endpoint.

```typescript
import { HttpTransport } from 'rn-structured-logger';

initLogger({
  transports: [
    HttpTransport({
      url: 'https://your-logging-endpoint.com/logs',
      headers: { Authorization: 'Bearer your-token' },
    }),
  ],
});
```

### Custom Transports

Implement your own transport:

```typescript
const customTransport = {
  name: 'CustomTransport',
  write: (records: LogRecord[]) => {
    // Send logs to your custom destination
    console.log('Custom transport received:', records);
  },
  flush: async () => {
    // Optional: flush any buffered data
  },
  dispose: async () => {
    // Optional: clean up resources
  },
};

initLogger({
  transports: [customTransport],
});
```

## Configuration Options

### LoggerConfig

```typescript
interface LoggerConfig {
  level?: LogLevel; // 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  transports?: Transport[];
  redactor?: Redactor;
  sampling?: { rate: number }; // 0.0 to 1.0
  rateLimit?: { maxPerMin: number };
  batch?: { size: number; intervalMs: number };
  device?: Record<string, unknown>;
  patchConsole?: boolean;
}
```

## API Reference

### Core Functions

- `initLogger(config: LoggerConfig)`: Initialize the logger with configuration.
- `getLogger(namespace?: string)`: Get a logger instance for the specified namespace.

### Logger Methods

- `trace(message: string, context?: object)`
- `debug(message: string, context?: object)`
- `info(message: string, context?: object)`
- `warn(message: string, context?: object)`
- `error(message: string, context?: object)`
- `setCorrelationId(id?: string)`
- `flush(): Promise<void>`
- `dispose(): Promise<void>`

### Utility Functions

- `makeRedactor(keys: string[]): Redactor`: Create a redactor for the specified keys.

## Examples

### Expo App with File Logging

```typescript
import { initLogger, ConsoleTransport, FileTransport, makeRedactor } from 'rn-structured-logger';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const device = {
  platform: Platform.OS,
  model: Device.modelName,
  osVersion: Device.osVersion,
};

initLogger({
  level: 'info',
  transports: Platform.OS === 'web' ? [ConsoleTransport] : [ConsoleTransport, FileTransport({ fileName: 'expo-app.log' })],
  redactor: makeRedactor(['password', 'token']),
  device,
});
```

### Production Setup with Sentry

```typescript
import { initLogger, ConsoleTransport, SentryTransport, makeRedactor } from 'rn-structured-logger';

initLogger({
  level: 'warn',
  transports: [ConsoleTransport, SentryTransport()],
  redactor: makeRedactor(['password', 'token', 'email', 'ssn']),
  sampling: { rate: 0.1 },
  rateLimit: { maxPerMin: 100 },
  batch: { size: 20, intervalMs: 5000 },
});
```

## Troubleshooting

### Module Resolution Errors

If you encounter "Cannot find module 'rn-structured-logger'", ensure the package is installed and the local path is correct for development.

### File Transport Not Working

- Ensure `react-native-fs` is installed and linked.
- Check file permissions on the device.
- Verify the file path is writable.

### Console Patching Issues

If `patchConsole` causes issues with other libraries, set it to `false` and manually use the logger.

### Performance Issues

- Increase batch size or interval to reduce I/O.
- Use sampling in production to reduce log volume.
- Avoid logging large objects or frequent debug logs.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run `npm test`
6. Submit a pull request

## License

Apache License 2.0

## Documentation

- [API Documentation](./docs/) - Generated TypeDoc documentation for all classes, interfaces, and functions.
- [Demo App](./NativeDemo/) - Bare React Native demo application showcasing the library features.
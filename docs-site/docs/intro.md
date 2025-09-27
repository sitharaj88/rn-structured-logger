---
sidebar_position: 1
---

---
sidebar_label: Getting Started
---

# Getting Started with RN Structured Logger

RN Structured Logger is an enterprise-grade logging library for React Native and Expo applications. It provides structured logs, namespaces, context injection, batching, rate limiting, and redaction out of the box.

## Features

- **Structured log records** with timestamps, levels, messages, namespaces, and context
- **Pluggable transports** for console, file system, Sentry, and custom endpoints
- **Namespace support** for organized, hierarchical logging
- **Context injection** for correlation IDs and device metadata
- **Automatic redaction** of sensitive data (passwords, tokens, emails)
- **Rate limiting and sampling** to control log volume
- **Batching and async flushing** for optimal performance
- **Console patching** for third-party library compatibility
- **TypeScript support** with full type safety

## Installation

```bash
npm install rn-structured-logger
# or
yarn add rn-structured-logger
```

### Peer Dependencies

Install these peer dependencies based on the transports you need:

```bash
# For file logging on native platforms
npm install react-native-fs

# For Sentry integration
npm install @sentry/react-native

# For Expo device info (optional)
npm install expo-device
```

## Quick Start

```typescript
import { initLogger, getLogger, ConsoleTransport } from 'rn-structured-logger';

// Initialize the logger once at app startup
initLogger({
  level: 'info',
  transports: [ConsoleTransport],
});

// Get a logger instance and start logging
const logger = getLogger('app');
logger.info('Application started successfully');
```

## Basic Usage

### Simple Logging

```typescript
import { getLogger } from 'rn-structured-logger';

const logger = getLogger();

// Log different severity levels
logger.trace('Detailed trace information');
logger.debug('Debug information for development');
logger.info('General information about app operation');
logger.warn('Warning about potential issues');
logger.error('Error that occurred');
logger.fatal('Critical error requiring immediate attention');
```

### Logging with Context

```typescript
const logger = getLogger('user');

// Add structured context to your logs
logger.info('User login successful', {
  userId: 12345,
  loginMethod: 'email',
  timestamp: new Date().toISOString(),
  userAgent: 'Mobile App v1.0'
});
```

### Namespaced Loggers

```typescript
// Create organized logger hierarchy
const authLogger = getLogger('auth');
const apiLogger = getLogger('api');
const uiLogger = getLogger('ui');

// Each logger will have its namespace in the output
authLogger.info('User authentication started');
apiLogger.debug('API request to /users/profile');
uiLogger.warn('Component failed to render');
```

## Configuration

### Basic Configuration

```typescript
import { initLogger, ConsoleTransport, FileTransport } from 'rn-structured-logger';

initLogger({
  level: __DEV__ ? 'debug' : 'info', // Dynamic level based on environment
  transports: [
    ConsoleTransport, // Always include console logging
    // Add file logging only in production on native platforms
    ...(__DEV__ ? [] : [FileTransport({ fileName: 'app.log' })]),
  ],
});
```

### Advanced Configuration

```typescript
import { initLogger, ConsoleTransport, FileTransport, SentryTransport, makeRedactor } from 'rn-structured-logger';

initLogger({
  level: 'info',
  transports: [
    ConsoleTransport,
    FileTransport({
      fileName: 'app.log',
      maxBytes: 1024 * 1024, // 1MB rotation
    }),
    SentryTransport(), // Send errors to Sentry
  ],
  redactor: makeRedactor(['password', 'token', 'email', 'ssn']), // Auto-redact sensitive data
  sampling: { rate: 0.1 }, // Sample 10% of non-error logs in production
  rateLimit: { maxPerMin: 300 }, // Limit to 300 logs per minute
  batch: { size: 50, intervalMs: 2000 }, // Batch 50 logs every 2 seconds
  device: {
    appVersion: '1.0.0',
    platform: Platform.OS,
    // Add more device context as needed
  },
  patchConsole: true, // Redirect console.log to logger
});
```

## Platform Support

| Platform | Console Transport | File Transport | Sentry Transport | Custom Transport |
|----------|------------------|----------------|------------------|------------------|
| iOS      | ✅               | ✅             | ✅               | ✅               |
| Android  | ✅               | ✅             | ✅               | ✅               |
| Web (Expo)| ✅              | ❌             | ✅               | ✅               |
| macOS    | ✅               | ❌             | ✅               | ✅               |
| Windows  | ✅               | ❌             | ✅               | ✅               |

## Next Steps

- **[API Reference](./api-reference.md)** - Complete API documentation
- **[Examples](./examples.md)** - Real-world usage examples

## Need Help?

- 📖 [API Reference](./api-reference.md) - Complete technical documentation
- 💬 [GitHub Discussions](https://github.com/sitharaj88/rn-structured-logger/discussions) - Ask questions and share ideas
- 🐛 [GitHub Issues](https://github.com/sitharaj88/rn-structured-logger/issues) - Report bugs and request features

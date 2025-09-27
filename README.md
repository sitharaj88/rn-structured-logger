# RN Structured Logger

An enterprise‑grade logging library for React Native, Expo and cross‑platform JavaScript applications. It provides structured logs, namespaces, context injection, batching, rate limiting and redaction out of the box. Logs are batched and flushed asynchronously to reduce impact on the UI thread and can be persisted locally or forwarded to remote services such as Sentry.

## Documentation

- [API Documentation](./docs/) - Generated TypeDoc documentation for all classes, interfaces, and functions.

## Motivation

Effective logging is essential for maintaining, debugging and monitoring mobile applications.  Well‑structured logs provide insight into user actions, system events and performance metrics【267964047010966†L150-L180】.  At the same time, excessive logging can negatively impact performance, consume storage and leak sensitive data【267964047010966†L167-L170】【267964047010966†L247-L257】.  This library follows best practices outlined by modern observability guides, including log rotation, asynchronous batching, remote collection, rate limiting and data masking【267964047010966†L247-L263】.

## Features

- **Structured log records**: Each entry includes a timestamp, level, message, namespace and arbitrary context.
- **Pluggable transports**: Send logs to the JavaScript console, persist them to the local filesystem (with rotation), or forward them to Sentry or your own HTTP endpoint.  Multiple transports can run concurrently.
- **Namespaces (child loggers)**: Create scoped loggers (e.g. `auth:login`) to filter or group logs.
- **Context injection**: Attach correlation IDs, user identifiers, device metadata or any other static information to every log record.
- **Redaction**: Mask sensitive properties (password, token, etc.) before they leave the device.  You can specify additional keys to redact.
- **Rate limiting and sampling**: Protect your backend and devices by limiting the number of logs per minute and sampling non‑error logs at configurable rates.
- **Batching and asynchronous flushing**: Logs are buffered and written in batches on a background queue, minimizing UI thread impact【267964047010966†L247-L263】.  You control the batch size and flush interval.
- **Conditional logging**: Dynamically adjust severity levels at runtime (e.g. verbose debugging in development, minimal logging in production)【267964047010966†L247-L257】.
- **Console patching (optional)**: Redirect `console.log`, `warn`, `error` and `info` through your logger so all third‑party libraries follow your policies.
- **TypeScript types**: First‑class TypeScript support with strict typings.

## Platform Compatibility

This library is designed for cross-platform React Native and Expo applications:

- **iOS & Android**: Full functionality including file system logging via `react-native-fs`
- **Web (Expo)**: Console logging with full structured logging features (timestamps, levels, context, redaction)
- **macOS & Windows**: Console logging only (file system access not supported)

The logger automatically adapts to the platform - on web it uses only the ConsoleTransport, while on native platforms it can include file logging.

## Installation

```sh
npm install rn-structured-logger
# or
yarn add rn-structured-logger
```

You must also install `react-native-fs` and `@sentry/react-native` if you intend to use the file or Sentry transports:

```sh
yarn add react-native-fs @sentry/react-native
```

These are declared as peer dependencies so your project controls their versions.

## Usage

### Setup

Initialise the logger once, typically during app bootstrap.  Provide transports appropriate to your environment and inject static device information.

```ts
import { initLogger, ConsoleTransport, FileTransport, SentryTransport, makeRedactor } from 'rn-structured-logger';
import DeviceInfo from 'react-native-device-info';
import * as Sentry from '@sentry/react-native';

// gather static device/app info
const device = {
  appVersion: DeviceInfo.getVersion(),
  buildNumber: DeviceInfo.getBuildNumber(),
  os: DeviceInfo.getSystemName(),
  osVersion: DeviceInfo.getSystemVersion(),
  deviceId: DeviceInfo.getDeviceId(),
};

initLogger({
  level: __DEV__ ? 'debug' : 'info',
  transports: __DEV__
    ? [ConsoleTransport]
    : [ConsoleTransport, FileTransport({ fileName: 'app.log' }), SentryTransport()],
  redactor: makeRedactor(['email', 'phone']),
  sampling: { rate: __DEV__ ? 1 : 0.1 },
  rateLimit: { maxPerMin: 300 },
  batch: { size: 50, intervalMs: 2000 },
  device,
  patchConsole: true
});
```

### Logging events

Retrieve a logger via `getLogger()` and use its methods:

```ts
import { getLogger } from 'rn-structured-logger';

const logger = getLogger('auth:login');
logger.debug('Attempting login', { username: 'alice@example.com' });
try {
  const result = await authRepository.login(credentials);
  logger.info('Login successful', { userId: result.id });
} catch (error) {
  logger.error('Login failed', { error });
}

// set correlation ID for an entire flow
const rootLogger = getLogger();
rootLogger.setCorrelationId('req-9b2c1...');

// adjust level at runtime
rootLogger.setLevel('warn');
```

### Flushing and disposing

If your app needs to flush logs before exit or when the user logs out, call:

```ts
import { getLogger } from 'react-native-enterprise-logger';

await getLogger().flush();    // flush queued records
await getLogger().dispose();  // flush and dispose transports
```

## Transports

- **ConsoleTransport**: Writes logs to the console.  The message includes an ISO date, namespace and level.  Info and below use `console.debug`/`console.info`; warnings and errors use `console.warn`/`console.error`.
- **FileTransport**: Writes each batch of logs to a file using `react-native-fs`.  Rotates the log when it exceeds a size threshold (default 512 KiB).  Each record is stored as JSON on its own line.  Use log rotation and management to prevent logs from consuming too much storage【267964047010966†L167-L170】.
- **SentryTransport**: Sends error and fatal logs to Sentry via breadcrumbs and `captureMessage`.  Other levels are added as breadcrumbs only.  Requires `@sentry/react-native` to be installed.
- **HttpTransport**: Sends logs to a custom HTTP endpoint with JSON body.  You can specify additional headers (e.g. for authentication).  Logs are batched and sent via a single POST request to minimise network overhead【267964047010966†L259-L263】.

You can also implement your own transport by creating an object with a `name` and `write(batch: LogRecord[])` method.  Optionally implement `flush` and `dispose` for transports that need to perform asynchronous work during shutdown.

## Security and privacy

Protecting sensitive user data is paramount.  This library provides a simple redaction helper that masks keys like `password`, `token` and others.  You can specify additional keys when creating the redactor.  Always avoid logging personally identifiable information (PII) and secrets, and mask any confidential data before sending it anywhere【267964047010966†L279-L297】.  When sending logs to remote endpoints, ensure you use HTTPS and secure authentication【267964047010966†L294-L301】.

## License

MIT
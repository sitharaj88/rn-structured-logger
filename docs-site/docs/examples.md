---
sidebar_label: Examples
---

# Examples

This page contains practical examples showing how to use RN Structured Logger in real-world scenarios.

## Basic Setup Examples

### Development vs Production Configuration

```typescript
import { initLogger, ConsoleTransport, FileTransport, SentryTransport, makeRedactor } from 'rn-structured-logger';
import { Platform } from 'react-native';

// Development configuration
const devConfig = {
  level: 'debug',
  transports: [ConsoleTransport],
  patchConsole: true,
};

// Production configuration
const prodConfig = {
  level: 'info',
  transports: [
    ConsoleTransport,
    // File logging only on native platforms
    ...(Platform.OS !== 'web' ? [FileTransport({ fileName: 'app.log' })] : []),
    SentryTransport(),
  ],
  redactor: makeRedactor(['password', 'token', 'email', 'ssn']),
  sampling: { rate: 0.1 }, // Sample 10% of non-error logs
  rateLimit: { maxPerMin: 300 },
  batch: { size: 50, intervalMs: 2000 },
};

// Initialize based on environment
initLogger(__DEV__ ? devConfig : prodConfig);
```

### Expo App with Conditional File Logging

```typescript
import { initLogger, ConsoleTransport, FileTransport, makeRedactor } from 'rn-structured-logger';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Gather device information
const deviceInfo = {
  platform: Platform.OS,
  appVersion: '1.0.0',
  deviceModel: Device.modelName || 'unknown',
  osVersion: Device.osVersion || 'unknown',
  deviceName: Device.deviceName || 'unknown',
};

// Initialize logger with platform-specific transports
initLogger({
  level: 'info',
  // Use file transport only on native platforms
  transports: Platform.OS === 'web'
    ? [ConsoleTransport]
    : [ConsoleTransport, FileTransport({ fileName: 'expo-app.log' })],
  redactor: makeRedactor(['password', 'token', 'email']),
  device: deviceInfo,
  patchConsole: true,
});
```

## Logging Patterns

### User Authentication Flow

```typescript
import { getLogger } from 'rn-structured-logger';

const authLogger = getLogger('auth');
const apiLogger = getLogger('api');

class AuthService {
  async login(credentials: { email: string; password: string }) {
    const correlationId = `login-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Set correlation ID for the entire flow
    authLogger.setCorrelationId(correlationId);

    try {
      authLogger.info('Login attempt started', {
        email: credentials.email,
        loginMethod: 'email'
      });

      // Validate credentials
      authLogger.debug('Validating credentials');

      // Make API call
      apiLogger.info('Calling authentication API', {
        endpoint: '/auth/login',
        method: 'POST'
      });

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: credentials.email,
          // Password is automatically redacted by our redactor
          password: credentials.password
        })
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.status}`);
      }

      const userData = await response.json();

      authLogger.info('Login successful', {
        userId: userData.id,
        userRole: userData.role
      });

      return userData;

    } catch (error) {
      authLogger.error('Login failed', {
        error: error.message,
        email: credentials.email
      });
      throw error;
    } finally {
      // Clear correlation ID
      authLogger.setCorrelationId(undefined);
    }
  }
}
```

### API Request/Response Logging

```typescript
import { getLogger } from 'rn-structured-logger';

const apiLogger = getLogger('api');
const errorLogger = getLogger('error');

class ApiClient {
  private async makeRequest<T>(
    method: string,
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    apiLogger.info('API request started', {
      requestId,
      method,
      url,
      headers: options.headers,
      bodySize: options.body ? JSON.stringify(options.body).length : 0
    });

    try {
      const response = await fetch(url, {
        method,
        ...options,
        headers: {
          'X-Request-ID': requestId,
          ...options.headers
        }
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        apiLogger.warn('API request failed', {
          requestId,
          status: response.status,
          statusText: response.statusText,
          responseTime,
          error: errorText
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      apiLogger.info('API request completed', {
        requestId,
        status: response.status,
        responseTime,
        dataSize: JSON.stringify(data).length
      });

      return data;

    } catch (error) {
      const responseTime = Date.now() - startTime;

      errorLogger.error('API request error', {
        requestId,
        method,
        url,
        responseTime,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  async get<T>(url: string, options?: RequestInit): Promise<T> {
    return this.makeRequest('GET', url, options);
  }

  async post<T>(url: string, data: any, options?: RequestInit): Promise<T> {
    return this.makeRequest('POST', url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: JSON.stringify(data)
    });
  }
}
```

### Error Boundary with Structured Logging

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { getLogger } from 'rn-structured-logger';

const errorLogger = getLogger('error');
const uiLogger = getLogger('ui');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error with full context
    errorLogger.error('React Error Boundary caught an error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundary: 'main',
      timestamp: new Date().toISOString()
    });

    // Also log UI-specific information
    uiLogger.fatal('Application error occurred', {
      errorType: 'react_error_boundary',
      errorMessage: error.message,
      hasFallback: !!this.props.fallback
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>The error has been logged and reported.</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### Performance Monitoring

```typescript
import { getLogger } from 'rn-structured-logger';

const perfLogger = getLogger('performance');
const apiLogger = getLogger('api');

class PerformanceMonitor {
  private startTimes = new Map<string, number>();

  start(operation: string, context?: any) {
    const id = `${operation}-${Date.now()}`;
    this.startTimes.set(id, Date.now());

    perfLogger.debug('Operation started', {
      operation,
      operationId: id,
      context
    });

    return id;
  }

  end(operationId: string, context?: any) {
    const startTime = this.startTimes.get(operationId);
    if (!startTime) {
      perfLogger.warn('Performance monitoring: operation not found', {
        operationId
      });
      return;
    }

    const duration = Date.now() - startTime;
    this.startTimes.delete(operationId);

    const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';

    perfLogger.log(level, 'Operation completed', {
      operationId,
      duration,
      context
    });

    // Log slow operations
    if (duration > 5000) {
      perfLogger.warn('Slow operation detected', {
        operationId,
        duration,
        threshold: 5000,
        context
      });
    }
  }

  async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: any
  ): Promise<T> {
    const operationId = this.start(operation, context);
    try {
      const result = await fn();
      this.end(operationId, { ...context, success: true });
      return result;
    } catch (error) {
      this.end(operationId, { ...context, success: false, error: error.message });
      throw error;
    }
  }
}

// Usage example
const perfMonitor = new PerformanceMonitor();

async function fetchUserData(userId: string) {
  return perfMonitor.measureAsync(
    'fetchUserData',
    async () => {
      const response = await fetch(`/api/users/${userId}`);
      return response.json();
    },
    { userId, endpoint: '/api/users/:id' }
  );
}
```

### Custom Transport Example

```typescript
import { Transport, LogRecord } from 'rn-structured-logger';

class AnalyticsTransport implements Transport {
  name = 'analytics';
  private events: LogRecord[] = [];

  write(records: LogRecord[]): void {
    // Filter only info and warning levels for analytics
    const analyticsEvents = records.filter(
      record => record.level === 'info' || record.level === 'warn'
    );

    this.events.push(...analyticsEvents);

    // Send to analytics service in batches
    if (this.events.length >= 10) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.events.length === 0) return;

    try {
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: this.events.map(event => ({
            name: `${event.ns || 'app'}_${event.level}`,
            properties: {
              message: event.msg,
              context: event.ctx,
              timestamp: event.ts,
              correlationId: event.correlationId
            }
          }))
        })
      });

      this.events = [];
    } catch (error) {
      console.error('Failed to send analytics events:', error);
      // Keep events for retry
    }
  }

  async dispose(): Promise<void> {
    await this.flush();
  }
}

// Usage
import { initLogger, ConsoleTransport } from 'rn-structured-logger';

initLogger({
  level: 'info',
  transports: [ConsoleTransport, new AnalyticsTransport()]
});
```

## Configuration Examples

### Environment-Based Configuration

```typescript
// config/logger.config.ts
import { LoggerConfig, ConsoleTransport, FileTransport, SentryTransport, makeRedactor } from 'rn-structured-logger';

export function createLoggerConfig(): LoggerConfig {
  const isDevelopment = __DEV__;
  const isWeb = Platform.OS === 'web';

  const baseConfig: LoggerConfig = {
    level: isDevelopment ? 'debug' : 'info',
    redactor: makeRedactor(['password', 'token', 'email', 'ssn', 'creditCard']),
    patchConsole: isDevelopment,
  };

  if (isWeb) {
    // Web configuration
    return {
      ...baseConfig,
      transports: [ConsoleTransport],
      sampling: { rate: 0.5 }, // Sample 50% in web environment
    };
  } else {
    // Native configuration
    return {
      ...baseConfig,
      transports: [
        ConsoleTransport,
        FileTransport({
          fileName: `app-${new Date().toISOString().split('T')[0]}.log`,
          maxBytes: 2 * 1024 * 1024, // 2MB
        }),
        ...(isDevelopment ? [] : [SentryTransport()]),
      ],
      sampling: { rate: isDevelopment ? 1 : 0.1 },
      rateLimit: { maxPerMin: isDevelopment ? 1000 : 300 },
      batch: { size: 25, intervalMs: 1000 },
    };
  }
}
```

### React Native Navigation Logging

```typescript
import { NavigationContainer } from '@react-navigation/native';
import { getLogger } from 'rn-structured-logger';

const navLogger = getLogger('navigation');

const navigationRef = React.createRef();

function App() {
  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={(state) => {
        if (state) {
          const currentRoute = state.routes[state.index];
          navLogger.info('Navigation state changed', {
            currentRoute: currentRoute.name,
            routeParams: currentRoute.params,
            routeCount: state.routes.length,
            navigationType: 'state_change'
          });
        }
      }}
      onReady={() => {
        navLogger.info('Navigation container ready');
      }}
    >
      {/* Your navigation structure */}
    </NavigationContainer>
  );
}

// Manual navigation logging
export function logNavigation(routeName: string, params?: any) {
  navLogger.debug('Manual navigation', {
    routeName,
    params,
    navigationType: 'manual'
  });
}
```
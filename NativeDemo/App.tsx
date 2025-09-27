import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';

// Type definitions for the logger
interface Logger {
  trace(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  setCorrelationId(id?: string): void;
  flush(): Promise<void>;
}

export default function App() {
  const [logger, setLogger] = useState<Logger | null>(null);
  const [authLogger, setAuthLogger] = useState<Logger | null>(null);
  const [apiLogger, setApiLogger] = useState<Logger | null>(null);
  const [isLoggerReady, setIsLoggerReady] = useState(false);

  useEffect(() => {
    const initializeLogger = async () => {
      // Try dynamic import first (preferred for bundlers)
      let loggerModule: any | null = null;
      try {
        loggerModule = await import('rn-structured-logger');
      } catch (impErr) {
        // dynamic import failed — try require() as a fallback
        try {
          // @ts-ignore
          loggerModule = require('rn-structured-logger');
        } catch (reqErr) {
          // both imports failed — we'll fall back to a local console shim below
          console.warn('rn-structured-logger dynamic import and require both failed:', impErr, reqErr);
          loggerModule = null;
        }
      }

      try {
        if (loggerModule) {
          const {
            initLogger,
            getLogger,
            ConsoleTransport,
            FileTransport,
            makeRedactor,
          } = loggerModule;

          const transports = [ConsoleTransport];
          if (Platform.OS !== 'web') {
            // Only add native FileTransport when react-native-fs (native module) is present.
            // This avoids runtime crashes when running in Expo Go where native modules
            // like react-native-fs are not available. In that case we fall back to
            // console-only transport (ConsoleTransport).
            let canUseFileTransport = false;
            try {
              // Try to require the native dependency. If it's not available this will throw.
              // @ts-ignore
              const RNFS = require('react-native-fs');
              if (RNFS) canUseFileTransport = true;
            } catch (e) {
              console.info('react-native-fs not available; skipping FileTransport (console only)');
            }

            if (canUseFileTransport && typeof FileTransport === 'function') {
              try {
                transports.push(FileTransport({
                  fileName: 'demo-app.log',
                  maxBytes: 1024 * 1024,
                }));
              } catch (e) {
                console.warn('Failed to create FileTransport, continuing with ConsoleTransport only', e);
              }
            }
          }

          const device = {
            platform: Platform.OS,
            model: 'unknown',
            brand: 'unknown',
            appVersion: '1.0.0',
          };

          initLogger({
            level: 'debug',
            transports,
            redactor: makeRedactor(['password', 'token', 'creditCard']),
            sampling: { rate: 1 },
            rateLimit: { maxPerMin: 60 },
            batch: { size: 5, intervalMs: 2000 },
            device,
            patchConsole: true,
          });

          setLogger(getLogger('demo:app'));
          setAuthLogger(getLogger('demo:auth'));
          setApiLogger(getLogger('demo:api'));
          setIsLoggerReady(true);

          const appLogger = getLogger('demo:app');
          appLogger.info('Logger initialized', { device, transports: transports.length });
          return;
        }

        // Fallback shim: if we can't load the package, provide a tiny console logger
        const makeShimLogger = (ns?: string) => {
          let currentCorrelation: string | undefined;
          const format = (level: string, msg: string, ctx?: Record<string, unknown>) => {
            const ts = new Date().toISOString();
            const prefix = `[${ts}] ${ns ?? '-'} ${level.toUpperCase()}:`;
            const payload = ctx ? { ...ctx, correlationId: currentCorrelation } : { correlationId: currentCorrelation };
            if (level === 'error' || level === 'fatal') console.error(prefix, msg, payload);
            else if (level === 'warn') console.warn(prefix, msg, payload);
            else if (level === 'info') console.info(prefix, msg, payload);
            else console.debug(prefix, msg, payload);
          };

          return {
            trace: (m: string, c?: Record<string, unknown>) => format('trace', m, c),
            debug: (m: string, c?: Record<string, unknown>) => format('debug', m, c),
            info: (m: string, c?: Record<string, unknown>) => format('info', m, c),
            warn: (m: string, c?: Record<string, unknown>) => format('warn', m, c),
            error: (m: string, c?: Record<string, unknown>) => format('error', m, c),
            setCorrelationId: (id?: string) => { currentCorrelation = id; },
            flush: async () => { /* no-op */ },
          } as unknown as Logger;
        };

        setLogger(makeShimLogger('demo:app'));
        setAuthLogger(makeShimLogger('demo:auth'));
        setApiLogger(makeShimLogger('demo:api'));
        setIsLoggerReady(true);
        console.info('Using console shim logger (rn-structured-logger not available)');
      } catch (err) {
        console.error('Failed to initialize logger (unexpected):', err);
        setIsLoggerReady(true);
      }
    };

    initializeLogger();
  }, []);

  const handleBasicLogging = () => {
    if (!isLoggerReady) {
      Alert.alert('Logger Not Ready', 'Please wait for logger to initialize');
      return;
    }

    if (logger) {
      logger.trace('This is a trace message');
      logger.debug('This is a debug message', { userId: 123 });
      logger.info('This is an info message', { action: 'button_press' });
      logger.warn('This is a warning message', { warning: 'low_battery' });
      logger.error('This is an error message', { error: 'network_timeout' });
      Alert.alert('Basic Logging', `Check console logs! ${Platform.OS === 'web' ? '(Web: console only)' : '(Native: console + file)'}`);
    }
  };

  const handleContextLogging = () => {
    if (!isLoggerReady) {
      Alert.alert('Logger Not Ready', 'Please wait for logger to initialize');
      return;
    }

    if (logger && apiLogger) {
      logger.setCorrelationId('session-12345');
      logger.info('User logged in', {
        userId: 'user_456',
        email: 'user@example.com',
        timestamp: new Date().toISOString(),
      });

      // Simulate API call
      apiLogger.info('API request started', {
        method: 'GET',
        url: '/api/user/profile',
        headers: { authorization: 'Bearer token123' },
      });

      setTimeout(() => {
        apiLogger.info('API request completed', {
          status: 200,
          responseTime: 150,
        });
      }, 100);
      Alert.alert('Context Logging', 'Check logs for correlation ID and API simulation!');
    }
  };

  const handleRedactionDemo = () => {
    if (!isLoggerReady) {
      Alert.alert('Logger Not Ready', 'Please wait for logger to initialize');
      return;
    }

    if (logger) {
      logger.info('User registration attempt', {
        username: 'john_doe',
        password: 'secret123', // This will be redacted
        email: 'john@example.com',
        creditCard: '4111111111111111', // This will be redacted
        token: 'auth_token_abc123', // This will be redacted
        normalField: 'this is visible',
      });
      Alert.alert('Redaction Demo', 'Check logs - sensitive data should be masked!');
    }
  };

  const handleAuthFlow = () => {
    if (!isLoggerReady) {
      Alert.alert('Logger Not Ready', 'Please wait for logger to initialize');
      return;
    }

    if (authLogger) {
      authLogger.info('Login attempt', { username: 'admin' });

      // Simulate login process
      setTimeout(() => {
        authLogger.warn('Invalid password attempt', {
          username: 'admin',
          ip: '192.168.1.1',
          attempts: 1,
        });
      }, 500);

      setTimeout(() => {
        authLogger.error('Account locked', {
          username: 'admin',
          reason: 'too_many_attempts',
          lockoutDuration: '15_minutes',
        });
      }, 1000);
      Alert.alert('Auth Flow', 'Check logs for simulated authentication flow!');
    }
  };

  const handleErrorSimulation = () => {
    if (!isLoggerReady) {
      Alert.alert('Logger Not Ready', 'Please wait for logger to initialize');
      return;
    }

    if (logger) {
      try {
        // Simulate an error
        throw new Error('Simulated network error');
      } catch (error) {
        logger.error('Caught an error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          context: 'demo_error_simulation',
        });
      }
      Alert.alert('Error Simulation', 'Error logged with context!');
    }
  };

  const handleFlushLogs = async () => {
    if (!isLoggerReady) {
      Alert.alert('Logger Not Ready', 'Please wait for logger to initialize');
      return;
    }

    if (logger) {
      try {
        await logger.flush();
        Alert.alert('Logs Flushed', `All pending logs have been written! ${Platform.OS === 'web' ? '(Web: console flushed)' : '(Native: console + file flushed)'}`);
      } catch (error) {
        Alert.alert('Flush Error', 'Failed to flush logs');
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.title}>RN Structured Logger Demo</Text>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.description}>
          Tap buttons below to see different logging scenarios in action.
          Check console output{Platform.OS !== 'web' ? ' and log files' : ''} for results.
        </Text>

        <TouchableOpacity style={styles.button} onPress={handleBasicLogging}>
          <Text style={styles.buttonText}>Basic Logging</Text>
          <Text style={styles.buttonSubtext}>All log levels (trace, debug, info, warn, error)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleContextLogging}>
          <Text style={styles.buttonText}>Context & Correlation</Text>
          <Text style={styles.buttonSubtext}>Structured data with correlation IDs</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleRedactionDemo}>
          <Text style={styles.buttonText}>Data Redaction</Text>
          <Text style={styles.buttonSubtext}>Sensitive data masking (passwords, tokens)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleAuthFlow}>
          <Text style={styles.buttonText}>Auth Flow Logging</Text>
          <Text style={styles.buttonSubtext}>Namespaced loggers for different modules</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleErrorSimulation}>
          <Text style={styles.buttonText}>Error Handling</Text>
          <Text style={styles.buttonSubtext}>Exception logging with stack traces</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.flushButton]} onPress={handleFlushLogs}>
          <Text style={styles.buttonText}>Flush Logs</Text>
          <Text style={styles.buttonSubtext}>Force write all buffered logs</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Features Demonstrated:</Text>
          <Text style={styles.infoText}>• Structured logging with context</Text>
          <Text style={styles.infoText}>• Namespaced loggers</Text>
          <Text style={styles.infoText}>• Data redaction</Text>
          <Text style={styles.infoText}>• Asynchronous batching</Text>
          <Text style={styles.infoText}>• Multiple transports (Console + File)</Text>
          <Text style={styles.infoText}>• Correlation IDs</Text>
          <Text style={styles.infoText}>• Device metadata injection</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 50,
    marginBottom: 10,
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  flushButton: {
    backgroundColor: '#FF9500',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  buttonSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  infoBox: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    lineHeight: 20,
  },
});

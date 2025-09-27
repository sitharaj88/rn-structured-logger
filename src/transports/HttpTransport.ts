import { Transport, LogRecord } from '../types';

/**
 * Options for configuring the HttpTransport.
 */
export interface HttpTransportOptions {
  /** URL to which batches will be POSTed */
  url: string;
  /** Additional headers sent with every request (e.g. auth tokens) */
  headers?: Record<string, string>;
}

/**
 * Creates a transport that sends logs to a remote HTTP endpoint. Batches of
 * records are converted to JSON and sent via POST. If the request fails, the
 * error is silently swallowed. For reliability you may want to implement
 * retry or offline persistence externally.
 * @param opts - Configuration options including the target URL
 * @returns A Transport instance for HTTP logging
 */
export function HttpTransport(opts: HttpTransportOptions): Transport {
  const { url, headers } = opts;
  return {
    name: 'http',
    async write(batch: LogRecord[]): Promise<void> {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
          body: JSON.stringify(batch)
        });
      } catch (err) {
        // network errors are ignored; consider implementing retry
      }
    }
  };
}
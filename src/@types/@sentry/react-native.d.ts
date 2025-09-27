declare module '@sentry/react-native' {
  export interface Breadcrumb {
    category?: string;
    message?: string;
    level?: string;
    data?: any;
  }
  export function addBreadcrumb(breadcrumb: Breadcrumb): void;
  export function captureMessage(message: string, options?: { level?: string; extra?: any }): void;
  export function flush(timeout?: number): Promise<boolean>;
  const Sentry: any;
  export default Sentry;
}
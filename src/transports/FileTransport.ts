import { Transport, LogRecord } from '../types';
import RNFS from 'react-native-fs';

export interface FileTransportOptions {
  /** File name relative to cache directory. Defaults to 'logs.txt'. */
  fileName?: string;
  /** Maximum log file size in bytes before rotation. Defaults to 512 KiB. */
  maxBytes?: number;
}

/**
 * Creates a transport that writes logs to a file on disk using react-native-fs.
 * Each batch is appended as newline‑separated JSON.  When the file exceeds
 * `maxBytes` the current log file is moved to a rotated file with a timestamp
 * suffix and a new file is created.  Rotated files are not automatically
 * deleted; your app is responsible for cleaning up old logs.
 */
export function FileTransport(opts: FileTransportOptions = {}): Transport {
  const fileName = opts.fileName ?? 'app.log';
  const maxBytes = opts.maxBytes ?? 512 * 1024;
  const path = `${RNFS.CachesDirectoryPath}/${fileName}`;

  async function rotateIfNeeded(): Promise<void> {
    try {
      const stat = await RNFS.stat(path);
      if (stat.isFile() && stat.size > maxBytes) {
        const rotatedPath = `${path}.${Date.now()}`;
        await RNFS.moveFile(path, rotatedPath);
      }
    } catch (err) {
      // ignore if file does not exist
    }
  }

  return {
    name: 'file',
    async write(batch: LogRecord[]): Promise<void> {
    try {
      await rotateIfNeeded();
      const lines = batch.map(rec => JSON.stringify(rec)).join('\n') + '\n';
      await RNFS.appendFile(path, lines, 'utf8');
    } catch (err) {
      // silently ignore file write errors to avoid crashing the app
    }
  },
    async flush(): Promise<void> {
      // nothing to flush; writes are immediate
    }
  };
}
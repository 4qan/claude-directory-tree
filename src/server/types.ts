import type { ScanResponse } from '../scanner/types.js';

export interface ServerOptions {
  port: number;
  scanResult: ScanResponse;
}

/** Connection settings for a raw TCP/IP printer transport. */
export interface TCPConfig {
  host: string;
  /** Default 9100 (standard raw port); some vendors (e.g. SATO) use 1024. */
  port?: number;
  /** Connection timeout in ms. */
  timeout?: number;
}

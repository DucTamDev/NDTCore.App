export type PrintFanoutMode = 'failover' | 'broadcast';

export interface PrintDestination {
  id: string;
  name: string;
  printerIds: string[];
  fanoutMode: PrintFanoutMode;
  enabled: boolean;
}

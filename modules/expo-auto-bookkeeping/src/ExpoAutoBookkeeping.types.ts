export interface NotificationEvent {
  readonly packageName: string;
  readonly title: string;
  readonly text: string;
  readonly timestamp: number;
}

export interface ServiceStatus {
  readonly permissionGranted: boolean;
  readonly serviceConnected: boolean;
}

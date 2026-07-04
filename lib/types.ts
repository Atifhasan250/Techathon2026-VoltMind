export type DeviceType = "fan" | "light";

export type RoomName = "Drawing Room" | "Work Room 1" | "Work Room 2";

export type DeviceStatus = "on" | "off";

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  room: RoomName;
  status: DeviceStatus;
  wattage: number;
  lastChanged: string;
}

export interface PowerSummary {
  totalWatts: number;
  perRoom: Record<RoomName, number>;
  estimatedDailyKwh: number;
  devicesOn: number;
  devicesOff: number;
  measuredAt: string;
}

export type AnalyticsRange = "1h" | "8h" | "24h" | "7d" | "30d" | "today";

export interface PowerHistoryPoint {
  timestamp: string;
  averageWatts: number;
  peakWatts: number;
  perRoom: Record<RoomName, number>;
}

export interface EnergyAnalytics {
  range: AnalyticsRange;
  persistenceEnabled: boolean;
  actualEnergyKwh: number;
  estimatedDailyKwh: number;
  averageWatts: number;
  peakWatts: number;
  perRoomKwh: Record<RoomName, number>;
  samples: PowerHistoryPoint[];
  measuredAt: string;
}

export interface DeviceToggleResponse {
  success: true;
  device: Device;
  message: string;
}

export type AlertType = "after-hours" | "all-devices-on" | "long-running";

export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  room: RoomName;
  severity: "warning" | "critical";
  timestamp: string;
  devices: string[];
}

export type StreamEvent =
  | {
      type: "snapshot";
      data: { devices: Device[]; power: PowerSummary; alerts: Alert[] };
      timestamp: string;
    }
  | {
      type: "state-changed";
      data: { device: Device; power: PowerSummary; alerts: Alert[] };
      timestamp: string;
    }
  | {
      type: "alerts-changed";
      data: { alerts: Alert[] };
      timestamp: string;
    };

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
    };

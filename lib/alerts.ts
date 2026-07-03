import {
  ALERT_THRESHOLDS,
  OFFICE_HOURS,
  ROOM_NAMES,
} from "@/lib/constants";
import { getAllDevices } from "@/lib/devices";
import type { Alert, Device, RoomName } from "@/lib/types";

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function alertTimestamp(devices: Device[]): string {
  return devices.reduce(
    (earliest, device) => device.lastChanged < earliest ? device.lastChanged : earliest,
    devices[0]?.lastChanged ?? new Date().toISOString(),
  );
}

function afterHoursAlert(room: RoomName, devices: Device[]): Alert | undefined {
  const onDevices = devices.filter((device) => device.status === "on");
  if (onDevices.length === 0) return undefined;
  const fans = onDevices.filter((device) => device.type === "fan").length;
  const lights = onDevices.length - fans;

  return {
    id: `after-hours-${room.toLowerCase().replaceAll(" ", "-")}`,
    type: "after-hours",
    severity: "warning",
    room,
    message: `${room} has ${plural(fans, "fan")} and ${plural(lights, "light")} on after office hours.`,
    timestamp: alertTimestamp(onDevices),
    devices: onDevices.map((device) => device.id),
  };
}

export function getActiveAlerts(now = new Date()): Alert[] {
  const devices = getAllDevices();
  const alerts: Alert[] = [];
  const outsideOfficeHours = now.getHours() < OFFICE_HOURS.start || now.getHours() >= OFFICE_HOURS.end;

  for (const room of ROOM_NAMES) {
    const roomDevices = devices.filter((device) => device.room === room);
    const allOn = roomDevices.every((device) => device.status === "on");

    if (outsideOfficeHours) {
      const alert = afterHoursAlert(room, roomDevices);
      if (alert) alerts.push(alert);
    }

    if (!allOn) continue;
    const timestamp = alertTimestamp(roomDevices);
    alerts.push({
      id: `all-devices-on-${room.toLowerCase().replaceAll(" ", "-")}`,
      type: "all-devices-on",
      severity: "critical",
      room,
      message: `All devices in ${room} are on simultaneously.`,
      timestamp,
      devices: roomDevices.map((device) => device.id),
    });

    const newestChange = Math.max(
      ...roomDevices.map((device) => new Date(device.lastChanged).getTime()),
    );
    if (now.getTime() - newestChange >= ALERT_THRESHOLDS.longRunningMs) {
      alerts.push({
        id: `long-running-${room.toLowerCase().replaceAll(" ", "-")}`,
        type: "long-running",
        severity: "warning",
        room,
        message: `All devices in ${room} have been on continuously for more than two hours.`,
        timestamp,
        devices: roomDevices.map((device) => device.id),
      });
    }
  }

  return alerts;
}

import { ROOM_NAMES, resolveRoomName } from "../lib/constants";
import type { Alert, Device, EnergyAnalytics, PowerSummary, RoomName } from "../lib/types";

function onDevices(devices: Device[]): Device[] {
  return devices.filter((device) => device.status === "on");
}

function roomCounts(devices: Device[], room: RoomName): string {
  const active = onDevices(devices.filter((device) => device.room === room));
  const fans = active.filter((device) => device.type === "fan").length;
  const lights = active.filter((device) => device.type === "light").length;
  return `${room}: ${fans} fan${fans === 1 ? "" : "s"} ON, ${lights} light${lights === 1 ? "" : "s"} ON`;
}

export function formatStatus(devices: Device[]): string {
  return ROOM_NAMES.map((room) => roomCounts(devices, room)).join(". ") + ".";
}

export function formatRoom(devices: Device[], requestedRoom: string): string | undefined {
  const room = resolveRoomName(requestedRoom);
  if (!room) return undefined;

  const roomDevices = devices.filter((device) => device.room === room);
  const details = roomDevices.map((device) => {
    const watts = device.status === "on" ? `${device.wattage}W` : "0W";
    return `${device.name}: ${device.status.toUpperCase()} (${watts})`;
  });
  return `${room} — ${details.join(", ")}.`;
}

export function formatUsage(power: PowerSummary, analytics?: EnergyAnalytics): string {
  const rooms = ROOM_NAMES.map((room) => `${room}: ${power.perRoom[room]}W`).join(", ");
  const energy = analytics
    ? `Today's measured usage: ${analytics.actualEnergyKwh} kWh.`
    : `Today's estimated usage: ${power.estimatedDailyKwh} kWh.`;
  return `Total power right now: ${power.totalWatts}W. ${energy} ${rooms}.`;
}

export function formatAlert(alert: Alert): string {
  return `⚠️ ${alert.message}`;
}

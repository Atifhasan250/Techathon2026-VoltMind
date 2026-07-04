import { EventEmitter } from "node:events";
import {
  ALERT_THRESHOLDS,
  OFFICE_HOURS,
  OFFICE_TIMEZONE,
  ROOM_NAMES,
} from "@/lib/constants";
import { deviceEvents, getAllDevices } from "@/lib/devices";
import type { Alert, Device, RoomName } from "@/lib/types";

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
}

interface AlertGlobals {
  emitter?: EventEmitter;
  timer?: ReturnType<typeof setInterval>;
  deviceListenerAttached?: boolean;
  signature?: string;
}

const globals = globalThis as typeof globalThis & { __voltMindAlerts?: AlertGlobals };
globals.__voltMindAlerts ??= {};
const state = globals.__voltMindAlerts;
state.emitter ??= new EventEmitter();
state.emitter.setMaxListeners(100);

export const alertEvents = state.emitter;

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function zonedParts(date: Date): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OFFICE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
  };
}

function zonedLocalTimeToUtc(parts: ZonedParts): Date {
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour);
  let timestamp = desired;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = zonedParts(new Date(timestamp));
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
    );
    timestamp += desired - observedAsUtc;
  }

  return new Date(timestamp);
}

function shiftLocalDate(parts: ZonedParts, days: number): ZonedParts {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: parts.hour,
  };
}

function afterHoursStart(now: Date): Date | undefined {
  const local = zonedParts(now);
  if (local.hour >= OFFICE_HOURS.end) {
    return zonedLocalTimeToUtc({ ...local, hour: OFFICE_HOURS.end });
  }
  if (local.hour < OFFICE_HOURS.start) {
    return zonedLocalTimeToUtc({
      ...shiftLocalDate(local, -1),
      hour: OFFICE_HOURS.end,
    });
  }
  return undefined;
}

function validTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function afterHoursAlert(
  room: RoomName,
  devices: Device[],
  periodStartedAt: Date,
): Alert | undefined {
  const onDevices = devices.filter((device) => device.status === "on");
  if (onDevices.length === 0) return undefined;
  const fans = onDevices.filter((device) => device.type === "fan").length;
  const lights = onDevices.length - fans;
  const firstOnAt = Math.min(...onDevices.map((device) => validTimestamp(device.lastChanged)));
  const triggeredAt = Math.max(periodStartedAt.getTime(), firstOnAt);

  return {
    id: `after-hours-${room.toLowerCase().replaceAll(" ", "-")}`,
    type: "after-hours",
    severity: "warning",
    room,
    message: `${room} has ${plural(fans, "fan")} and ${plural(lights, "light")} on after office hours.`,
    timestamp: new Date(triggeredAt).toISOString(),
    devices: onDevices.map((device) => device.id),
  };
}

export function evaluateAlerts(devices: Device[], now = new Date()): Alert[] {
  const alerts: Alert[] = [];
  const periodStartedAt = afterHoursStart(now);

  for (const room of ROOM_NAMES) {
    const roomDevices = devices.filter((device) => device.room === room);

    if (periodStartedAt) {
      const alert = afterHoursAlert(room, roomDevices, periodStartedAt);
      if (alert) alerts.push(alert);
    }

    const allOn = roomDevices.length > 0 && roomDevices.every((device) => device.status === "on");
    if (!allOn) continue;

    const allOnSince = Math.max(
      ...roomDevices.map((device) => validTimestamp(device.lastChanged)),
    );
    alerts.push({
      id: `all-devices-on-${room.toLowerCase().replaceAll(" ", "-")}`,
      type: "all-devices-on",
      severity: "critical",
      room,
      message: `All devices in ${room} are on simultaneously.`,
      timestamp: new Date(allOnSince).toISOString(),
      devices: roomDevices.map((device) => device.id),
    });

    const longRunningAt = allOnSince + ALERT_THRESHOLDS.longRunningMs;
    if (now.getTime() >= longRunningAt) {
      alerts.push({
        id: `long-running-${room.toLowerCase().replaceAll(" ", "-")}`,
        type: "long-running",
        severity: "warning",
        room,
        message: `All devices in ${room} have been on continuously for at least two hours.`,
        timestamp: new Date(longRunningAt).toISOString(),
        devices: roomDevices.map((device) => device.id),
      });
    }
  }

  return alerts;
}

export function getActiveAlerts(now = new Date()): Alert[] {
  return evaluateAlerts(getAllDevices(), now);
}

function alertSignature(alerts: Alert[]): string {
  return JSON.stringify(
    alerts.map(({ id, timestamp, devices }) => ({ id, timestamp, devices })),
  );
}

function syncAlertBaseline(): void {
  state.signature = alertSignature(getActiveAlerts());
}

function evaluateScheduledAlerts(): void {
  const alerts = getActiveAlerts();
  const signature = alertSignature(alerts);
  if (signature === state.signature) return;
  state.signature = signature;
  alertEvents.emit("alerts-changed", alerts);
}

export function startAlertMonitor(): void {
  if (!state.deviceListenerAttached) {
    deviceEvents.on("state-changed", syncAlertBaseline);
    state.deviceListenerAttached = true;
  }
  if (state.timer) return;

  syncAlertBaseline();
  state.timer = setInterval(evaluateScheduledAlerts, ALERT_THRESHOLDS.evaluationIntervalMs);
  state.timer.unref?.();
}

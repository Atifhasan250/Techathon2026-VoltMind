import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateAlerts } from "./alerts";
import type { Device, RoomName } from "./types";

const TWO_HOURS_MS = 2 * 60 * 60 * 1_000;

function roomDevices(room: RoomName, status: Device["status"], lastChanged: string): Device[] {
  return [
    { id: `${room}-fan-1`, name: "Fan 1", type: "fan", room, status, wattage: 60, lastChanged },
    { id: `${room}-fan-2`, name: "Fan 2", type: "fan", room, status, wattage: 60, lastChanged },
    { id: `${room}-light-1`, name: "Light 1", type: "light", room, status, wattage: 15, lastChanged },
    { id: `${room}-light-2`, name: "Light 2", type: "light", room, status, wattage: 15, lastChanged },
    { id: `${room}-light-3`, name: "Light 3", type: "light", room, status, wattage: 15, lastChanged },
  ];
}

function officeWithDrawingRoom(status: Device["status"], lastChanged: string): Device[] {
  return [
    ...roomDevices("Drawing Room", status, lastChanged),
    ...roomDevices("Work Room 1", "off", lastChanged),
    ...roomDevices("Work Room 2", "off", lastChanged),
  ];
}

test("uses Dhaka office hours independently of UTC", () => {
  const changedAt = "2026-07-04T08:00:00.000Z";
  const devices = officeWithDrawingRoom("on", changedAt);

  assert.equal(
    evaluateAlerts(devices, new Date("2026-07-04T10:59:59.000Z")).some(
      (alert) => alert.type === "after-hours",
    ),
    false,
  );
  const alertsAtFive = evaluateAlerts(devices, new Date("2026-07-04T11:00:00.000Z"));
  const afterHours = alertsAtFive.find((alert) => alert.type === "after-hours");
  assert.equal(afterHours?.timestamp, "2026-07-04T11:00:00.000Z");
});

test("triggers long-running when every device has been on for at least two hours", () => {
  const now = new Date("2026-07-04T08:00:00.000Z");
  const allOnSince = new Date(now.getTime() - TWO_HOURS_MS).toISOString();
  const devices = officeWithDrawingRoom("on", allOnSince);

  const longRunning = evaluateAlerts(devices, now).find(
    (alert) => alert.type === "long-running",
  );
  assert.equal(longRunning?.timestamp, now.toISOString());

  devices[0] = { ...devices[0], status: "off", lastChanged: now.toISOString() };
  assert.equal(
    evaluateAlerts(devices, now).some((alert) => alert.type === "long-running"),
    false,
  );
});

test("uses the last device-on time as the continuous all-on start", () => {
  const now = new Date("2026-07-04T08:00:00.000Z");
  const devices = officeWithDrawingRoom(
    "on",
    new Date(now.getTime() - 3 * 60 * 60 * 1_000).toISOString(),
  );
  devices[4] = {
    ...devices[4],
    lastChanged: new Date(now.getTime() - 90 * 60 * 1_000).toISOString(),
  };

  assert.equal(
    evaluateAlerts(devices, now).some((alert) => alert.type === "long-running"),
    false,
  );
});

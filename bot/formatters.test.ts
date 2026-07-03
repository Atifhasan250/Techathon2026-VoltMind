import assert from "node:assert/strict";
import test from "node:test";
import { formatRoom, formatStatus, formatUsage } from "./formatters";
import type { Device, PowerSummary } from "../lib/types";

const now = "2026-07-03T12:00:00.000Z";
const devices: Device[] = [
  { id: "d-f1", name: "Fan 1", type: "fan", room: "Drawing Room", status: "on", wattage: 60, lastChanged: now },
  { id: "d-l1", name: "Light 1", type: "light", room: "Drawing Room", status: "off", wattage: 15, lastChanged: now },
  { id: "w1-f1", name: "Fan 1", type: "fan", room: "Work Room 1", status: "off", wattage: 60, lastChanged: now },
  { id: "w2-l1", name: "Light 1", type: "light", room: "Work Room 2", status: "on", wattage: 15, lastChanged: now },
];

test("status derives room counts from device state", () => {
  assert.match(formatStatus(devices), /Drawing Room: 1 fan ON, 0 lights ON/);
  assert.match(formatStatus(devices), /Work Room 2: 0 fans ON, 1 light ON/);
});

test("room aliases resolve and preserve actual states", () => {
  assert.equal(formatRoom(devices, "work1"), "Work Room 1 — Fan 1: OFF (0W).");
  assert.equal(formatRoom(devices, "missing"), undefined);
});

test("usage preserves backend totals", () => {
  const power: PowerSummary = { totalWatts: 75, perRoom: { "Drawing Room": 60, "Work Room 1": 0, "Work Room 2": 15 }, estimatedDailyKwh: 0.6, devicesOn: 2, devicesOff: 13, measuredAt: now };
  assert.match(formatUsage(power), /Total power right now: 75W/);
  assert.match(formatUsage(power), /0.6 kWh/);
});

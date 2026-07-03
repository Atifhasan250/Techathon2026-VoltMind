import { EventEmitter } from "node:events";
import {
  FANS_PER_ROOM,
  LIGHTS_PER_ROOM,
  ROOM_NAMES,
  SIMULATOR_CONFIG,
  WATTAGE,
} from "@/lib/constants";
import type { Device, DeviceType, PowerSummary, RoomName } from "@/lib/types";

interface DeviceGlobals {
  devices?: Device[];
  emitter?: EventEmitter;
  simulatorTimer?: ReturnType<typeof setTimeout>;
}

const globals = globalThis as typeof globalThis & { __voltMind?: DeviceGlobals };
globals.__voltMind ??= {};
const state = globals.__voltMind;

function slugify(value: string): string {
  return value.toLowerCase().replaceAll(" ", "-");
}

function createDevice(
  room: RoomName,
  type: DeviceType,
  index: number,
  now: string,
): Device {
  return {
    id: `${slugify(room)}-${type}-${index}`,
    name: `${type === "fan" ? "Fan" : "Light"} ${index}`,
    type,
    room,
    status: Math.random() < 0.4 ? "on" : "off",
    wattage: WATTAGE[type],
    lastChanged: now,
  };
}

function createInitialDevices(): Device[] {
  const now = new Date().toISOString();
  return ROOM_NAMES.flatMap((room) => [
    ...Array.from({ length: FANS_PER_ROOM }, (_, index) =>
      createDevice(room, "fan", index + 1, now),
    ),
    ...Array.from({ length: LIGHTS_PER_ROOM }, (_, index) =>
      createDevice(room, "light", index + 1, now),
    ),
  ]);
}

state.devices ??= createInitialDevices();
state.emitter ??= new EventEmitter();
state.emitter.setMaxListeners(100);

export const deviceEvents = state.emitter;

function copyDevice(device: Device): Device {
  return { ...device };
}

export function getAllDevices(): Device[] {
  return state.devices!.map(copyDevice);
}

export function getDevicesByRoom(room: RoomName): Device[] {
  return state.devices!.filter((device) => device.room === room).map(copyDevice);
}

export function getDeviceById(id: string): Device | undefined {
  const device = state.devices!.find((candidate) => candidate.id === id);
  return device ? copyDevice(device) : undefined;
}

export function setDeviceStatus(id: string, status: Device["status"]): Device | undefined {
  const device = state.devices!.find((candidate) => candidate.id === id);
  if (!device) return undefined;

  if (device.status !== status) {
    device.status = status;
    device.lastChanged = new Date().toISOString();
    deviceEvents.emit("state-changed", copyDevice(device));
  }

  return copyDevice(device);
}

export function toggleDevice(id: string): Device | undefined {
  const device = state.devices!.find((candidate) => candidate.id === id);
  if (!device) return undefined;
  return setDeviceStatus(id, device.status === "on" ? "off" : "on");
}

export function getPowerSummary(): PowerSummary {
  const perRoom = Object.fromEntries(ROOM_NAMES.map((room) => [room, 0])) as Record<
    RoomName,
    number
  >;
  let devicesOn = 0;

  for (const device of state.devices!) {
    if (device.status === "on") {
      devicesOn += 1;
      perRoom[device.room] += device.wattage;
    }
  }

  const totalWatts = Object.values(perRoom).reduce((sum, watts) => sum + watts, 0);
  return {
    totalWatts,
    perRoom,
    estimatedDailyKwh: Number(((totalWatts * 8) / 1_000).toFixed(2)),
    devicesOn,
    devicesOff: state.devices!.length - devicesOn,
    measuredAt: new Date().toISOString(),
  };
}

function randomInteger(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function runSimulationTick(): void {
  const count = randomInteger(1, SIMULATOR_CONFIG.maxDevicesToToggle);
  const candidates = [...state.devices!];

  for (let index = 0; index < count; index += 1) {
    const candidateIndex = randomInteger(0, candidates.length - 1);
    const [candidate] = candidates.splice(candidateIndex, 1);
    toggleDevice(candidate.id);
  }

  scheduleSimulationTick();
}
function scheduleSimulationTick(): void {
  const delay = randomInteger(
    SIMULATOR_CONFIG.minIntervalMs,
    SIMULATOR_CONFIG.maxIntervalMs,
  );
  state.simulatorTimer = setTimeout(runSimulationTick, delay);
  state.simulatorTimer.unref?.();
}

export function startSimulator(): void {
  if (state.simulatorTimer) return;
  scheduleSimulationTick();
}

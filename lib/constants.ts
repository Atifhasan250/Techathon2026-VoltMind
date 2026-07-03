import type { DeviceType, RoomName } from "@/lib/types";

export const ROOM_NAMES = [
  "Drawing Room",
  "Work Room 1",
  "Work Room 2",
] as const satisfies readonly RoomName[];

export const WATTAGE = {
  fan: 60,
  light: 15,
} as const satisfies Record<DeviceType, number>;

export const FANS_PER_ROOM = 2;
export const LIGHTS_PER_ROOM = 3;
export const DEVICES_PER_ROOM = FANS_PER_ROOM + LIGHTS_PER_ROOM;
export const TOTAL_DEVICES = DEVICES_PER_ROOM * ROOM_NAMES.length;

export const OFFICE_HOURS = {
  start: 9,
  end: 17,
} as const;

export const SIMULATOR_CONFIG = {
  minIntervalMs: 5_000,
  maxIntervalMs: 15_000,
  maxDevicesToToggle: 2,
} as const;

export const ALERT_THRESHOLDS = {
  longRunningMs: 2 * 60 * 60 * 1_000,
} as const;

export const MAX_POSSIBLE_WATTS =
  ROOM_NAMES.length *
  (FANS_PER_ROOM * WATTAGE.fan + LIGHTS_PER_ROOM * WATTAGE.light);

export const ROOM_ALIASES: Readonly<Record<string, RoomName>> = {
  drawing: "Drawing Room",
  "drawing-room": "Drawing Room",
  drawingroom: "Drawing Room",
  work1: "Work Room 1",
  "work-room-1": "Work Room 1",
  workroom1: "Work Room 1",
  work2: "Work Room 2",
  "work-room-2": "Work Room 2",
  workroom2: "Work Room 2",
};

export function resolveRoomName(value: string): RoomName | undefined {
  const normalized = value.trim().toLowerCase().replaceAll("_", "-");
  return ROOM_NAMES.find((room) => room.toLowerCase() === normalized) ?? ROOM_ALIASES[normalized];
}

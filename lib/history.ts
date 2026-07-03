import type { Collection, Document } from "mongodb";
import { ROOM_NAMES } from "@/lib/constants";
import { deviceEvents, getPowerSummary } from "@/lib/devices";
import { getMongoDatabase, isMongoConfigured } from "@/lib/mongodb";
import type {
  AnalyticsRange,
  Device,
  EnergyAnalytics,
  PowerSummary,
  RoomName,
} from "@/lib/types";

const SAMPLE_INTERVAL_MS = 60_000;
const MAX_INTEGRATION_GAP_MS = SAMPLE_INTERVAL_MS * 2;
const SAMPLE_RETENTION_DAYS = 90;
const EVENT_RETENTION_DAYS = 30;

interface HistoryGlobals {
  timer?: ReturnType<typeof setInterval>;
  listenerAttached?: boolean;
  indexesReady?: Promise<void>;
  lastIntegratedAt?: number;
  lastPower?: PowerSummary;
  pendingEnergyKwh?: number;
  pendingPerRoomKwh?: Record<RoomName, number>;
  sessionEnergyKwh?: number;
  sessionPerRoomKwh?: Record<RoomName, number>;
  sessionPeakWatts?: number;
  sessionWattSeconds?: number;
  sessionDurationSeconds?: number;
  sessionStartedAt?: number;
}

const globals = globalThis as typeof globalThis & { __voltMindHistory?: HistoryGlobals };
globals.__voltMindHistory ??= {};
const state = globals.__voltMindHistory;

function emptyRoomValues(): Record<RoomName, number> {
  return Object.fromEntries(ROOM_NAMES.map((room) => [room, 0])) as Record<RoomName, number>;
}

function initializeState(): void {
  const now = Date.now();
  state.lastIntegratedAt ??= now;
  state.lastPower ??= getPowerSummary();
  state.pendingEnergyKwh ??= 0;
  state.pendingPerRoomKwh ??= emptyRoomValues();
  state.sessionEnergyKwh ??= 0;
  state.sessionPerRoomKwh ??= emptyRoomValues();
  state.sessionPeakWatts ??= state.lastPower.totalWatts;
  state.sessionWattSeconds ??= 0;
  state.sessionDurationSeconds ??= 0;
  state.sessionStartedAt ??= now;
}

function integrateUntil(timestamp: number): void {
  initializeState();
  const elapsedMs = Math.max(
    0,
    Math.min(timestamp - state.lastIntegratedAt!, MAX_INTEGRATION_GAP_MS),
  );
  const hours = elapsedMs / 3_600_000;
  const seconds = elapsedMs / 1_000;
  const power = state.lastPower!;
  const energy = (power.totalWatts * hours) / 1_000;

  state.pendingEnergyKwh! += energy;
  state.sessionEnergyKwh! += energy;
  state.sessionWattSeconds! += power.totalWatts * seconds;
  state.sessionDurationSeconds! += seconds;
  state.sessionPeakWatts = Math.max(state.sessionPeakWatts!, power.totalWatts);

  for (const room of ROOM_NAMES) {
    const roomEnergy = (power.perRoom[room] * hours) / 1_000;
    state.pendingPerRoomKwh![room] += roomEnergy;
    state.sessionPerRoomKwh![room] += roomEnergy;
  }

  state.lastIntegratedAt = timestamp;
}

async function collections(): Promise<{
  samples: Collection<Document>;
  events: Collection<Document>;
} | null> {
  const database = await getMongoDatabase();
  if (!database) return null;
  const samples = database.collection("power_samples");
  const events = database.collection("device_events");

  if (!state.indexesReady) {
    const indexesReady = Promise.all([
      samples.createIndex({ timestamp: 1 }),
      samples.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
      events.createIndex({ changedAt: -1 }),
      events.createIndex({ deviceId: 1, changedAt: -1 }),
      events.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
    ]).then(() => undefined);
    state.indexesReady = indexesReady;

    try {
      await indexesReady;
    } catch (error) {
      if (state.indexesReady === indexesReady) state.indexesReady = undefined;
      throw error;
    }
  } else {
    await state.indexesReady;
  }
  return { samples, events };
}

async function recordDeviceEvent(device: Device): Promise<void> {
  const store = await collections();
  if (!store) return;
  const changedAt = new Date(device.lastChanged);
  await store.events.insertOne({
    deviceId: device.id,
    name: device.name,
    type: device.type,
    room: device.room,
    status: device.status,
    wattage: device.wattage,
    changedAt,
    expireAt: new Date(changedAt.getTime() + EVENT_RETENTION_DAYS * 86_400_000),
  });
}

async function recordPowerSample(): Promise<void> {
  const timestamp = Date.now();
  integrateUntil(timestamp);
  const power = getPowerSummary();
  state.lastPower = power;

  const capturedEnergy = state.pendingEnergyKwh!;
  const capturedPerRoom = { ...state.pendingPerRoomKwh! };
  const store = await collections();

  if (!store) return;

  const date = new Date(timestamp);
  await store.samples.insertOne({
    timestamp: date,
    totalWatts: power.totalWatts,
    perRoom: power.perRoom,
    devicesOn: power.devicesOn,
    devicesOff: power.devicesOff,
    intervalEnergyKwh: capturedEnergy,
    perRoomEnergyKwh: capturedPerRoom,
    expireAt: new Date(date.getTime() + SAMPLE_RETENTION_DAYS * 86_400_000),
  });

  state.pendingEnergyKwh = Math.max(0, state.pendingEnergyKwh! - capturedEnergy);
  for (const room of ROOM_NAMES) {
    state.pendingPerRoomKwh![room] = Math.max(
      0,
      state.pendingPerRoomKwh![room] - capturedPerRoom[room],
    );
  }
}

function onStateChanged(device: Device): void {
  integrateUntil(Date.now());
  state.lastPower = getPowerSummary();
  void recordDeviceEvent(device).catch((error) =>
    console.error("[MongoDB] Device event write failed:", error),
  );
}

export function startHistoryRecorder(): void {
  initializeState();
  if (!state.listenerAttached) {
    deviceEvents.on("state-changed", onStateChanged);
    state.listenerAttached = true;
  }
  if (state.timer) return;

  void recordPowerSample().catch((error) =>
    console.error("[MongoDB] Initial power sample failed:", error),
  );
  state.timer = setInterval(() => {
    void recordPowerSample().catch((error) =>
      console.error("[MongoDB] Power sample write failed:", error),
    );
  }, SAMPLE_INTERVAL_MS);
  state.timer.unref?.();
}

const RANGE_CONFIG: Record<AnalyticsRange, { durationMs: number; bucketMinutes: number }> = {
  "1h": { durationMs: 3_600_000, bucketMinutes: 1 },
  "8h": { durationMs: 8 * 3_600_000, bucketMinutes: 5 },
  "24h": { durationMs: 24 * 3_600_000, bucketMinutes: 15 },
  "7d": { durationMs: 7 * 86_400_000, bucketMinutes: 120 },
  "30d": { durationMs: 30 * 86_400_000, bucketMinutes: 360 },
  today: { durationMs: 24 * 3_600_000, bucketMinutes: 15 },
};

export function resolveAnalyticsRange(value: string | null): AnalyticsRange {
  return value && value in RANGE_CONFIG ? (value as AnalyticsRange) : "24h";
}

function sessionAnalytics(range: AnalyticsRange): EnergyAnalytics {
  integrateUntil(Date.now());
  const power = getPowerSummary();
  const averageWatts = state.sessionDurationSeconds
    ? state.sessionWattSeconds! / state.sessionDurationSeconds
    : power.totalWatts;
  return {
    range,
    persistenceEnabled: false,
    actualEnergyKwh: Number(state.sessionEnergyKwh!.toFixed(4)),
    estimatedDailyKwh: power.estimatedDailyKwh,
    averageWatts: Math.round(averageWatts),
    peakWatts: state.sessionPeakWatts!,
    perRoomKwh: Object.fromEntries(
      ROOM_NAMES.map((room) => [room, Number(state.sessionPerRoomKwh![room].toFixed(4))]),
    ) as Record<RoomName, number>,
    samples: [],
    measuredAt: new Date().toISOString(),
  };
}

export async function getEnergyAnalytics(range: AnalyticsRange): Promise<EnergyAnalytics> {
  startHistoryRecorder();
  const store = await collections();
  if (!store) return sessionAnalytics(range);

  const now = new Date();
  const config = RANGE_CONFIG[range];
  const start = range === "today"
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : new Date(now.getTime() - config.durationMs);

  const [result] = await store.samples.aggregate<{
    totals: Array<{
      actualEnergyKwh: number;
      averageWatts: number;
      peakWatts: number;
      drawingRoomKwh: number;
      workRoom1Kwh: number;
      workRoom2Kwh: number;
    }>;
    points: Array<{
      timestamp: Date;
      averageWatts: number;
      peakWatts: number;
      drawingRoomWatts: number;
      workRoom1Watts: number;
      workRoom2Watts: number;
    }>;
  }>([
    { $match: { timestamp: { $gte: start, $lte: now } } },
    {
      $facet: {
        totals: [{
          $group: {
            _id: null,
            actualEnergyKwh: { $sum: "$intervalEnergyKwh" },
            averageWatts: { $avg: "$totalWatts" },
            peakWatts: { $max: "$totalWatts" },
            drawingRoomKwh: { $sum: "$perRoomEnergyKwh.Drawing Room" },
            workRoom1Kwh: { $sum: "$perRoomEnergyKwh.Work Room 1" },
            workRoom2Kwh: { $sum: "$perRoomEnergyKwh.Work Room 2" },
          },
        }],
        points: [
          {
            $group: {
              _id: {
                $dateTrunc: {
                  date: "$timestamp",
                  unit: "minute",
                  binSize: config.bucketMinutes,
                },
              },
              averageWatts: { $avg: "$totalWatts" },
              peakWatts: { $max: "$totalWatts" },
              drawingRoomWatts: { $avg: "$perRoom.Drawing Room" },
              workRoom1Watts: { $avg: "$perRoom.Work Room 1" },
              workRoom2Watts: { $avg: "$perRoom.Work Room 2" },
            },
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              timestamp: "$_id",
              averageWatts: 1,
              peakWatts: 1,
              drawingRoomWatts: 1,
              workRoom1Watts: 1,
              workRoom2Watts: 1,
            },
          },
        ],
      },
    },
  ]).toArray();

  const totals = result?.totals[0];
  const power = getPowerSummary();
  return {
    range,
    persistenceEnabled: isMongoConfigured(),
    actualEnergyKwh: Number((totals?.actualEnergyKwh ?? 0).toFixed(4)),
    estimatedDailyKwh: power.estimatedDailyKwh,
    averageWatts: Math.round(totals?.averageWatts ?? power.totalWatts),
    peakWatts: totals?.peakWatts ?? power.totalWatts,
    perRoomKwh: {
      "Drawing Room": Number((totals?.drawingRoomKwh ?? 0).toFixed(4)),
      "Work Room 1": Number((totals?.workRoom1Kwh ?? 0).toFixed(4)),
      "Work Room 2": Number((totals?.workRoom2Kwh ?? 0).toFixed(4)),
    },
    samples: (result?.points ?? []).map((point) => ({
      timestamp: point.timestamp.toISOString(),
      averageWatts: Math.round(point.averageWatts),
      peakWatts: point.peakWatts,
      perRoom: {
        "Drawing Room": Math.round(point.drawingRoomWatts),
        "Work Room 1": Math.round(point.workRoom1Watts),
        "Work Room 2": Math.round(point.workRoom2Watts),
      },
    })),
    measuredAt: now.toISOString(),
  };
}

import type { Alert, Device, PowerSummary } from "../lib/types";

export interface OfficeSnapshot {
  devices: Device[];
  power: PowerSummary;
  alerts: Alert[];
}

const baseUrl = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function getOfficeSnapshot(): Promise<OfficeSnapshot> {
  const response = await fetch(`${baseUrl}/api/state`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }

  return (await response.json()) as OfficeSnapshot;
}

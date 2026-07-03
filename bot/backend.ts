import type { Alert, Device, EnergyAnalytics, PowerSummary } from "../lib/types";

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

export async function getEnergyAnalytics(): Promise<EnergyAnalytics | undefined> {
  try {
    const response = await fetch(`${baseUrl}/api/analytics?range=today`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { analytics: EnergyAnalytics };
    return body.analytics;
  } catch {
    return undefined;
  }
}

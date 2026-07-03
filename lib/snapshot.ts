import { getActiveAlerts } from "@/lib/alerts";
import { getAllDevices, getPowerSummary } from "@/lib/devices";

export function getOfficeSnapshot() {
  return {
    devices: getAllDevices(),
    power: getPowerSummary(),
    alerts: getActiveAlerts(),
  };
}
